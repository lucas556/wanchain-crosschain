"use strict";


let dbname = 'crossTransDb';
let wanHashXSend = require('../wanchaintrans/index.js').wanHashXSend;
let ethHashXSend = require('../wanchaintrans/index.js').ethHashXSend;
let NormalSend = require('../wanchaintrans/index.js').NormalSend;
let CoinAmount = require('../wanchaintrans/index.js').CoinAmount;
let GWeiAmount = require('../wanchaintrans/index.js').GWeiAmount;
const Web3 = require("web3");
var web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'));
let logDebug;
module.exports = class sendTransaction{
    constructor(sendServer,protocol,opt){
        this.sendServer = sendServer;
        this.protocol = protocol;
        this.opt = opt;
        logDebug = global.getLogger('sendTransaction');
    }
    createTransaction(from,tokenAddress,amountWan,storeman,wanAddress,gas,gasPriceGwei,crossType,nonce){
        let amount = amountWan ? new CoinAmount(amountWan) : amountWan;
        let gasPrice = gasPriceGwei ? new GWeiAmount(gasPriceGwei) : gasPriceGwei;
        let WanKeyStoreDir = global.WanKeyStoreDir;
        let EthKeyStoreDir = global.EthKeyStoreDir;
        if(this.sendServer.chainType == 'WAN'){
            //this.trans = new wanHashXSend(from,tokenAddress,amount,storeman,wanAddress,gas,gasPrice,crossType,nonce);
          console.log("new wanHashXSend OPT:",this.opt,"protocol:",this.protocol);
            this.trans = new wanHashXSend(from,tokenAddress,amount,storeman,wanAddress,gas,gasPrice,crossType,nonce,
              this.protocol,this.opt);
            this.trans.setAccount(WanKeyStoreDir);
        }
        else
        {
            //this.trans = new ethHashXSend(from,tokenAddress,amount,storeman,wanAddress,gas,gasPrice,crossType,nonce);
          console.log("new ethHashXSend OPT:",this.opt,"protocol:",this.protocol);
            this.trans = new ethHashXSend(from,tokenAddress,amount,storeman,wanAddress,gas,gasPrice,crossType,nonce,
              this.protocol,this.opt);
            this.trans.setAccount(EthKeyStoreDir);
        }
    }

    createNormalTransaction(from,to,value,gas,gasPriceGwei,nonce){
        let amount = value ? new CoinAmount(value) : value;
        let gasPrice = gasPriceGwei ? new GWeiAmount(gasPriceGwei) : gasPriceGwei;
        let WanKeyStoreDir = global.WanKeyStoreDir;
        let EthKeyStoreDir = global.EthKeyStoreDir;
        this.trans = new NormalSend(from,to,amount,gas,gasPrice,nonce);
        this.trans.ChainType = this.sendServer.chainType
        if(this.sendServer.chainType == 'WAN'){
            this.trans.setAccount(WanKeyStoreDir);
        }
        else
        {
            this.trans.setAccount(EthKeyStoreDir);
        }
    }

    createRefundFromLockTransaction(lockTxHash,tokenAddress,amountWan,storeman,wanAddress,gas,gasPriceGwei,crossType,nonce){
        let self = this;
        let collection = global.getCollection(dbname,'crossTransaction');
        let lockTrans = collection.findOne({lockTxHash : lockTxHash});
        if(lockTrans) {
            self.createTransaction(lockTrans.crossAdress, tokenAddress, amountWan, storeman,
                wanAddress, gas, gasPriceGwei, crossType, nonce);
            self.trans.setKey(lockTrans.x);
        }
    }
    createRevokeFromLockTransaction(lockTxHash,tokenAddress,amountWan,storeman,wanAddress,gas,gasPriceGwei,crossType,nonce){
        let self = this;
        let collection = global.getCollection(dbname,'crossTransaction');
        let lockTrans = collection.findOne({lockTxHash : lockTxHash});
        if(lockTrans) {
            self.createTransaction(lockTrans.from, tokenAddress, amountWan, storeman,
                wanAddress, gas, gasPriceGwei, crossType, nonce);
            self.trans.setKey(lockTrans.x);
        }
    }

    sendLockTrans(password,callback){
        let self = this;
        this.trans.setLockData();
        self.getNonce(function () {
            self.sendTrans(self.trans,password,self.insertLockData,callback);
        })
    }
    sendRefundTrans(password,callback){
        let self = this;
        this.trans.setRefundData();
        try{
          self.getNonce(function () {
            self.sendTrans(self.trans,password,self.insertRefundData,callback);
          })
        }catch(error){
            console.log("sendRefundTrans error:",error);
        }
        // self.getNonce(function () {
        //     self.sendTrans(self.trans,password,self.insertRefundData,callback);
        // })
    }
    sendRevokeTrans(password,callback){
        let self = this;
        this.trans.setRevokeData();
        self.getNonce(function () {
            self.sendTrans(self.trans,password,self.insertRevokeData,callback);
        })
    }
    sendNormalTrans(password,callback){
        let self = this;
        self.getNonce(function () {
            self.sendTrans(self.trans,password,self.insertNormalData,callback);
        })
    }
    getNonce(callback){
        console.log("Entering getNonce!");
        let self = this;
        if(self.trans.trans.nonce || self.sendServer.web3){
            console.log("self.trans.trans.nonce ",self.trans.trans.nonce);
            callback();
            return;
        }

        this.sendServer.sendMessage('getNonce',this.trans.trans.from,function (err,result) {
            console.log("this.sendServer.sendMessage");
            if(!err){
              console.log("nonce from API: ",result);
                self.trans.trans.nonce = result;
            }else{
                console.log("Error getNonce: ",err);
            }

            callback();
        });
    }
    sendTrans(trans,password,insert,callback){
      console.log("Entering sendTrans ");
        let chainType = this.sendServer.chainType;
        this.sendServer.send(trans,password,function (err,result) {
            logDebug.debug(err,result);
            if(!err){
                logDebug.debug("sendRawTransaction: ",result);
                console.log("sendRawTransaction: ",result);
                insert(trans,result,chainType);
                callback(err,result);
            }
            else{
                console.log("sendTrans, Error: ", err);
                callback(err,result);
            }
        })
    }
    insertLockData(trans,result,chainType){
        global.getCollectionCb(dbname,'crossTransaction', function(collection){
            let cur = Date.now();
            collection.insert(
                {
                    HashX : trans.Contract.hashKey,
                    from : trans.trans.from,
                    to : trans.trans.to,
                    storeman:trans.Contract.storeman,
                    crossAdress : trans.Contract.crossAddress,
                    value : trans.Amount.getAmount(),
                    txValue: trans.trans.value,
                    x : trans.Contract.key,
                    time : cur.toString(),
                    HTLCtime: (100000+2*1000*Number(global.lockedTime)+cur).toString(),
                    chain : chainType,
                    status : 'sentHashPending',
                    lockConfirmed:0,
                    refundConfirmed:0,
                    revokeConfirmed:0,
                    lockTxHash: result,
                    refundTxHash : '',
                    revokeTxHash : '',

                });
        })

    }
    insertNormalData(trans,result,chainType){
        global.getCollectionCb(dbname,'crossTransaction', function(collection){
            collection.insert(
                {
                    from : trans.trans.from,
                    to : trans.trans.to,
                    value : web3.fromWei(trans.trans.value).toString(10),
                    time : Date.now().toString(),
                    txhash: result,
                    chain : chainType,

                });
        });
    }

    insertRefundData(trans,result){
        global.getCollectionCb(dbname,'crossTransaction', function(collection){
            let value = collection.findOne({HashX:trans.Contract.hashKey});
            if(value){
                value.refundTxHash = result;
                collection.update(value);
            }
        });
    }
    insertRevokeData(trans,result){
        global.getCollectionCb(dbname,'crossTransaction', function(collection){
            let value = collection.findOne({HashX:trans.Contract.hashKey});
            if(value){
                value.revokeTxHash = result;
                collection.update(value);
            }
        });
    }
}