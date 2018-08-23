exports.IContract = require('./contract/IContract.js');

exports.hashContract = require('./cross_contract/hashContract.js');

exports.hashXSend = require('./cross_transactions/hashXSend.js');
exports.ethHashXSend = require('./cross_transactions/ethHashXSend.js');
exports.wanHashXSend = require('./cross_transactions/wanHashXSend.js');
exports.NormalSend = require('./interface/transaction.js').NormalSend;
