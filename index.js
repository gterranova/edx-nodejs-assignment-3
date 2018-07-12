const fs = require('fs');
const path = require('path');
const async = require('async');
const mongodb = require('mongodb');

const url = 'mongodb://192.168.1.150:27017/edx-course-db';
const customerData = require('./m3-customer-data.json');
const customerAddressData = require('./m3-customer-address-data.json');

const handleError = (err) => {
    console.log(err);
    process.exit(1);
};

const getCustomerChunk = (idx, count) => {
    const numItems = Math.min(count, customerData.length);
    return { 
        start: idx*count+1,
        end: idx*count+numItems,
        customers: customerData.splice(0, numItems).map( (c, idx) => Object.assign(c, customerAddressData[idx]))
    };
};

const insertTask = (data, db) => {
    const { start, end, customers } = data;
    return (callback) => {
        console.log(`Processing customers from ${start}-${end}`);
        db.collection('accounts')
            .insert(customers, (err, data) => {
                if (err) return callback(err);
                callback(null, { inserted: data.insertedCount, updated: 0 });
            });
    };
};

const insertOrUpdateTask = (data, db) => {
    const { start, end, customers } = data;
    return (callback) => {
        console.log(`Processing customers from ${start}-${end} (inserting or updating if already existing, one by one)`);
        async.parallel( customers.map( customer => {
            return (cb) => {
                db.collection('accounts').find({ id: customer.id }).toArray( (err, results) => {
                    if (err) return cb(err);
                    if (!results.length) {
                        // console.log("Insert", customer.id);
                        db.collection('accounts').insert(customer, cb);
                    } else {
                        // console.log("Update", customer.id);
                        db.collection('accounts').update({ _id: results[0]._id }, { $set: customer }, cb);
                    }
                });    
            }
        }), (err, data) => {
            if (err) return callback(err);
            callback(null, { 
                inserted: data.reduce((acc, curr) => acc + (curr.insertedCount || 0), 0),
                updated: data.reduce((acc, curr) => acc + (curr.result.nModified || 0), 0)
             });
        });
    };
};

function migrate(chunkSize, taskOperation) {
    const start = Date.now();

    mongodb.MongoClient.connect(url, (err, db) => {
        let remainingCustomers = customerData.length;
        const chunks = []; let idx = 0;
        while (remainingCustomers>0) {
            chunks.push(getCustomerChunk(idx++, chunkSize));
            remainingCustomers -= chunkSize;
        }
        async.parallel(chunks.map( chunk => taskOperation(chunk, db)), (err, data) => {
            if (err) return handleError(err);
            const { 0: inserts, 1: updates } = data.reduce((acc, curr) => [acc[0]+curr.inserted, acc[1]+curr.updated], [0, 0]);
            console.log(`Inserted ${inserts} new documents, updated ${updates}.`);
            console.log(`Completed in ${Math.round((Date.now()-start)/10)/100}s\n`);
            db.close();
        });
    });
}

let argv = process.argv.slice(2);
if (!argv.length) {
    console.log("\nUsage: node . [chunk size] [--check-duplicates]");
    console.log("\nUsing defaults: chunks of 100 documents, batch insert with no check");
}
const chunkSize = argv.length ? parseInt(argv[0], 10) : 100;
const checkDup = argv.length > 1 && argv[1] === '--check-duplicates';
const task = checkDup ? insertOrUpdateTask : insertTask;
console.log(`Migrating data to ${url} in chunks of ${chunkSize} ${checkDup?'':'without '}avoiding duplicates...`);

migrate(chunkSize, task);