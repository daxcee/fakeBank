'use strict';
var parse = require('co-body');
//var co = require('co');

require('../utils.js');



//GET /bills/ -> List all bills in JSON
module.exports.all = function* list(next) {
    if ('GET' != this.method) return yield next;

    //this.request.scrap.userId should have the user id which corresponds to the token
    //find accounts which correspond to the userId
    var allbills = yield this.app.db.bills.find({
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
    var allbills = yield this.app.db.bills.find({
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
    var allbills = yield this.app.db.bills.find({
        "userId": this.request.scrap.userId,
        "isPaid": false
    }).sort({
        DTSDue: 1
    }).exec();
    //return them all
    this.body = yield allbills;
};





//POST /bills/:id/pay/ -> Gets the bill paid.
module.exports.pay = function* pay(id, next) {
    if ('POST' != this.method) return yield next;

    var resp = {};
    resp.success = false;
    try {
        var body = yield parse.json(this);
        if (!body || ((body.srcAcc) && (body.status !== "on") && (body.status !== "off"))) this.throw(405, "Error, srcAcc missing or has a wrong value");


        var srcAccount = yield this.app.db.accounts.findOne({
            "userId": this.request.scrap.userId,
            "id": srcAcc
        }).exec();

        if (!srcAccount || srcAccount.id !== srcAcc) this.throw(404, JSON.stringify({
            error: true,
            text: "Error: can't find the source account"
        }));


        var bill = yield this.app.db.bills.findOne({
            "userId": this.request.scrap.userId,
            "billId": id
        }).exec();


        if (bill.isPaid) this.throw(405, 'Error: bill is already paid');
        if (bill.isExpired) this.throw(405, 'Error: bill is already expired');
        if (bill.DTSExpiry && ((new Date(bill.DTSExpiry)) > (new Date()))) this.throw(405, 'Error: bill has  expired');

        var amount = bill.amount;
        var currency = bill.currency;
        if (!amount || !currency) this.throw(500, 'Error: bill is incorrect');

        var toBeDebitedAmount = GLOBAL.fxrates.convertCurrency(
            srcAccount.balance.currency,
            amount,
            currency); //convert transaction currency into the currency of the account

        if (srcAccount.balance.native < toBeDebitedAmount) this.throw(405, 'Error: not enough money on the source account');



        srcAccount.balance.native -= toBeDebitedAmount;

        var numChanged;
        numChanged = yield this.app.db.accounts.update({
            "userId": this.request.scrap.userId,
            "id": srcAccount.id
        }, srcAccount, {});
        if (numChanged < 1) this.throw(405, "Error, could not change source account");


        //now add the transaction info
        var transaction = {
            "accountId": srcAccount.sourceAccount.id,
            "transactionId": GLOBAL.GetRandomSTR(12),
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
            "labels": body.labels || ['bill payment']
        };
        numChanged = yield this.app.db.transactions.insert(transaction);


        //now mark the bill paid
        bill.isPaid = true;
        bill.DTSPaid = new Date();

        numChanged = yield this.app.db.bills.update({
            "id": id
        }, bill, {});
        console.log('Bill paid successfully');
        resp.success = true;
        resp.text = 'Bill has been paid';
        this.body = JSON.stringify(resp);
    } catch (e) {
        resp.text = "Error parsing JSON";
        console.log(e);
        this.throw(405, "Error parsing JSON.");
    }
};
