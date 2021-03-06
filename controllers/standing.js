'use strict';
let parse = require('co-body');
//let co = require('co');

require('../utils.js');



//GET /standing/ -> List all standing orders in JSON
module.exports.all = function* list(next) {
    if ('GET' != this.method) return yield next;

    //this.request.scrap.userId should have the user id which corresponds to the token
    //find accounts which correspond to the userId
    let allstanding = yield this.app.db.standing.find({
        "userId": this.request.scrap.userId
    }).sort({
        DTS: 1
    }).exec();
    //return them all
    this.body = yield allstanding;
};




// PUT /standing/ -> add a new standing order
module.exports.add = function* add(data, next) {
    if ('PUT' != this.method) return yield next;

    let resp = {
        success: false
    };

    try {
        let body = yield parse.json(this);
        if (!body || !body.transactionTypeID) this.throw(404, JSON.stringify({
            error: true,
            text: 'Not enough parameters in the request body'
        }));

        let user = yield this.app.db.userDetails.findOne({
            "userId": this.request.scrap.userId
        }).exec();

        if (!user || user.userId !== this.request.scrap.userId) this.throw(405, "Error: can not find the user." + this.request.scrap.userId);

        let tempStanding = {};
        for (let property in body) { //blindly copy all the object properties sent in the request body
            if (body.hasOwnProperty(property)) {
                tempStanding[property] = body[property];
            }
        }

        tempStanding.DTS = new Date();
        tempStanding.userId = user.userId;
        tempStanding.standingId = GLOBAL.GetRandomSTR(12);
        let tempId = tempStanding.standingId;

        let inserted = yield this.app.db.standing.insert(tempStanding);
        if (!inserted) {
            this.throw(405, "Error: Failed adding the new standing instruction.");
        }
        console.log('added the new standing instruction');
    } catch (e) {
        console.log('error', e);
        this.throw(500, "Error: Standing instruction could not be added");
    }

    resp.success = true;
    resp.text = 'Standing instruction has been added';
    this.body = JSON.stringify(resp);
};





//DELETE /standing/:id -> Deletes given standing order.
module.exports.deleteStanding = function* deleteStanding(id, next) {
    if ('DELETE' != this.method) return yield next;
    let resp = {};
    try {
        let standing = yield this.app.db.standing.findOne({
            "userId": this.request.scrap.userId,
            "standingId": id
        }).exec();

        if (!standing.standingId) this.throw(404, JSON.stringify({
            error: true,
            text: 'Standing order not found'
        }));

        let user = yield this.app.db.userDetails.findOne({
            "userId": this.request.scrap.userId
        }).exec();

        if (!user || user.userId !== this.request.scrap.userId) this.throw(405, "Error: can not find the user." + this.request.scrap.userId);


        let numChanged = yield this.app.db.standing.remove({
            "standingId": id
        }, {});

        resp.success = true;
        this.body = JSON.stringify(resp);
    } catch (e) {
        resp.text = "Error deleting standing order";
        console.log(resp.text, e);
        this.throw(405, "Error deleting standing order.");
    }
}
