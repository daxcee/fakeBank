console.log('Generating fake transactions');
//run this once a month to generate transactions
//Transactions get stored in a db_future table

//Create a transaction template file and name it as ACCOUNTID_templates.json
//Run as node generator.js <ACCOUNTID> <MONTHOFFSET>
//where ACCOUNTID is a an id of the account you generate transactions for
//MONTHOFFSET can be 0 for a current month, -1 for the previous, 1 for the next one, etc.



let accountId = process.argv[2];
let monthShift = process.argv[3] || 0;
if (!accountId) throw 'no account given. Specify accountId as a command line parameter'; //TODO: break if no account given

let fs = require('fs');
let templates = JSON.parse(fs.readFileSync(accountId + '_templates.json', 'utf8'));

let TempDate = new Date();

let Year = (TempDate).getFullYear();
let Month = (TempDate).getMonth() + monthShift;
let daysInMonth = getDaysInMonth(Month + 1, Year);

let tempArray = [];
let counter = 0;
console.log(templates.length, 'templates loaded');
for (let i = 0; i < templates.length; i++) {
	let temp = templates[i];

	for (let ee = 0; ee < temp.nPerMonth; ee++) {
		if (temp.probability > Math.random()) {
			let tempRecord = {};
			tempRecord.accountId = accountId;
			tempRecord.amount = Math.random() * (temp.amountMax - temp.amountMin) + temp.amountMin;
			if (temp.integer) tempRecord.amount = Math.floor(tempRecord.amount);
			tempRecord.amount = parseFloat(tempRecord.amount.toFixed(2));
			tempRecord.currency = temp.currency;
			let dayOfMonth = Math.floor(1 + (daysInMonth - 1) * Math.random());
			tempRecord.narrative = temp.narrative;
			tempRecord.txnType = temp.txnType;
			tempRecord.type = temp.type;
			tempRecord.DTSValue = new Date(Year, Month, dayOfMonth);
			console.log(Year, Month, dayOfMonth);
			tempRecord.DTSValue.setMinutes(24 * 60 * Math.random());
			tempRecord.DTSBooked = new Date(tempRecord.DTSValue.getTime());
			tempRecord.DTSBooked.setMinutes(tempRecord.DTSValue.getMinutes() + 12 * 60 * Math.random());
			if (tempRecord.amount > 0) {
				tempRecord.credit = tempRecord.amount;
				tempRecord.debit = 0;
			}
			if (tempRecord.amount <= 0) {
				tempRecord.credit = 0;
				tempRecord.debit = tempRecord.amount;
			}
			tempRecord.reference = GetRandomSTR(10);
			tempRecord.transactionId = GetRandomSTR(10);
			tempRecord.stateId = "100";
			tempRecord.labels = [];
			tempRecord.transactionState = "RECONCILED";
			// console.log(counter++, (ee + 1) + "/" + temp.nPerMonth, tempRecord.DTSValue, tempRecord.narrative);
			tempArray.push(tempRecord);
		}
	}
}

for (i = 0; i < tempArray.length; i++) {
	console.log(tempArray[i].DTSValue, tempArray[i].narrative)
}


//console.log(Resp);

let Datastore = require('nedb'),
	db = new Datastore({
		filename: 'db_future',
		autoload: true
	});

db.insert(tempArray, function (err, newDoc) {
	console.log('Transactions were written into the db_future');
});


//fs.writeFile("92999.json", JSON.stringify(tempArray), function (err) {
//    if (err) {
//        return console.log(err);
//    }
//    console.log("The file was saved!");
//});



function getDaysInMonth(month, year) {
	return new Date(year, month, 0).getDate();
}


function GetRandomSTR(GivenLength) {
	let resp = "";
	while (resp.length < GivenLength) {
		resp += Math.random().toString(36).substr(2, GivenLength);
	}
	return resp.substring(0, GivenLength);
}
