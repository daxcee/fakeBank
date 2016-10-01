This this was supposed to generate random transactions. Not entirely random, but random within a specified range of amounts, dates, etc.
Those rules are specified in template files.

Once started manually generator.js script will generate the transactions and will put them into db_future
Every time fakeBank starts it picks up transactions from db_future

It kinda works but date-times are messed up. Should redo the whole thing from scratch.

