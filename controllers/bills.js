'use strict';
let parse = require('co-body');
//let co = require('co');

require('../utils.js');



//GET /bills/ -> List all bills in JSON
module.exports.all = function* list(next) {
	if ('GET' != this.method) return yield next;

	//this.request.scrap.userId should have the user id which corresponds to the token
	//find accounts which correspond to the userId
	let allbills = yield this.app.db.bills.find({
		"userId": this.request.scrap.userId
	}).sort({
		DTSDue: 1
	}).exec();
	//return them all
	this.body = yield allbills;
};


//GET /bills/paid -> List all bills paid
module.exports.paid = function* paid(next) {
	if ('GET' != this.method) return yield next;

	//this.request.scrap.userId should have the user id which corresponds to the token
	//find accounts which correspond to the userId
	let allbills = yield this.app.db.bills.find({
		"userId": this.request.scrap.userId,
		"isPaid": true
	}).sort({
		DTSPaid: 1
	}).exec();
	//return them all
	this.body = yield allbills;
};


//GET /bills/unpaid -> List all bills unpaid
module.exports.unpaid = function* unpaid(next) {
	if ('GET' != this.method) return yield next;

	//this.request.scrap.userId should have the user id which corresponds to the token
	//find accounts which correspond to the userId
	let allbills = yield this.app.db.bills.find({
		"userId": this.request.scrap.userId,
		"isPaid": false
	}).sort({
		DTSDue: 1
	}).exec();
	//return them all
	this.body = yield allbills;
};

//GET /bills/history/:dateStart/:dateEnd -> List of transactions
module.exports.history = function* history(dateStart, dateEnd, next) {

	dateStart = new Date(parseInt(dateStart)); //TODO: potentially problematic, redo
	dateEnd = new Date(parseInt(dateEnd));
	dateStart = dateStart || (new Date()).addMinutes(60 * 24 * 30);
	dateEnd = dateEnd || (new Date());
	dateStart = (new Date()).addMinutes(-60 * 24 * 30);
	dateEnd = (new Date());

	let allaccounts = yield this.app.db.accounts.find({
		"userId": this.request.scrap.userId
	}).sort({
		isMain: -1,
		DTSOpened: 1
	}).exec();

	let transactions = [];
	let temp = [];

	for (let acc of allaccounts) {

		temp = yield this.app.db.transactions.find({
			"txnType": 30, //!!!??? hardcoded
			"accountId": acc.id,
			DTSValue: {
				$gt: dateStart,
				$lt: dateEnd
			}
		}).exec();
		for (let tran of temp)
			transactions.push(tran);

	}

	//TODO: sort the transactions


	this.body = yield transactions;
};



//POST /bills/:id/pay/ -> Gets the bill paid.
module.exports.pay = function* pay(id, next) {
	if ('POST' != this.method) return yield next;

	let resp = {};
	resp.success = false;
	try {
		let body = yield parse.json(this);
		if (!body || !body.srcAcc) this.throw(405, "Error, srcAcc missing or has a wrong value");


		let srcAccount = yield this.app.db.accounts.findOne({
			"userId": this.request.scrap.userId,
			"id": body.srcAcc
		}).exec();

		if (!srcAccount || srcAccount.id !== body.srcAcc) this.throw(404, JSON.stringify({
			error: true,
			text: "Error: can't find the source account"
		}));


		let bill = yield this.app.db.bills.findOne({
			"userId": this.request.scrap.userId,
			"billId": id
		}).exec();


		if (bill.isPaid) this.throw(405, 'Error: bill is already paid');
		if (bill.isExpired) this.throw(405, 'Error: bill is already expired');
		if (bill.DTSExpiry && ((new Date(bill.DTSExpiry)) < (new Date()))) this.throw(405, 'Error: bill has  expired');


		let amount = bill.amount;
		let currency = bill.currency;
		if (!amount || !currency) this.throw(500, 'Error: bill is incorrect');

		let toBeDebitedAmount = GLOBAL.fxrates.convertCurrency(
			srcAccount.balance.currency,
			amount,
			currency); //convert transaction currency into the currency of the account


		toBeDebitedAmount = parseFloat(toBeDebitedAmount);

		if (srcAccount.balance.native < toBeDebitedAmount) this.throw(405, 'Error: not enough money on the source account');



		srcAccount.balance.native -= toBeDebitedAmount;

		let numChanged;
		numChanged = yield this.app.db.accounts.update({
			"userId": this.request.scrap.userId,
			"id": srcAccount.id
		}, srcAccount, {});
		if (numChanged < 1) this.throw(405, "Error, could not change source account");


		bill.isPaid = true;
		bill.status = 'paid';
		bill.isActive = false;
		bill.DTSPaid = new Date();
		bill.transactionId = GLOBAL.GetRandomSTR(12);



		//now add the transaction info
		let transaction = {
			"accountId": srcAccount.id,
			"transactionId": bill.transactionId,
			"txnType": 30, //!!! hardcoded
			"typeName": 'Utility payment', //!!! hardcoded
			"narrative": body.narrative || "Bill payment " + (bill.providerName || "") + " " + (bill.shortDescription || ""),
			"debit": toBeDebitedAmount,
			"credit": 0,
			"amount": -amount,
			"currency": currency,
			"DTSValue": new Date(),
			"DTSBooked": new Date(),
			"stateId": "100", //### hardcoded transaction state ID
			"transactionState": "RECONCILED", //### hardcoded transaction state
			"reference": GLOBAL.GetRandomSTR(15),
			"labels": body.labels || ['bill payment'],
			"bill": bill
		};
		numChanged = yield this.app.db.transactions.insert(transaction);


		//now mark the bill paid
		numChanged = yield this.app.db.bills.update({
			"billId": bill.billId
		}, bill, {});
		console.log('Bill paid successfully');
		resp.success = true;
		resp.transaction = transaction;

		resp.text = 'Bill has been paid';
		this.body = JSON.stringify(resp);
	} catch (e) {
		resp.text = "Error parsing JSON";
		console.log(e);
		this.throw(405, "Error parsing JSON.");
	}
};
