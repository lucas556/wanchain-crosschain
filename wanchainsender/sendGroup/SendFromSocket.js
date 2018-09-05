"use strict";

let logDebug;
const cm = require('../../comm.js');
module.exports = class SendFromSocket{
    constructor(socket,chainType){
        this.socket = socket;
        logDebug = cm.getLogger('socketmessage');
        this.chainType = chainType;
    }
    close(){
        this.socket.close();
    }
    send(trans,password,callback){
        logDebug.debug(trans.trans);
        let rawTx = trans.signFromKeystore(password);
        logDebug.debug('rawTx:',rawTx);
        if(rawTx){
            this.socket.sendMessage('sendRawTransaction',rawTx,this.chainType,callback);
        }
        else{
            callback({error:'wrong password'},null);
        }
    }
    hasMessage(msg){
        return this.socket.messageFactory[msg];
    }
    sendMessage(...args){
        let args1 = args;
        var nLen = args.length-1;
        args1.splice(nLen,0,this.chainType);
        this.socket.sendMessage(...args1);
    }
}
