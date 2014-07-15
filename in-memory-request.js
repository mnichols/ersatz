'use strict';

var Expectation = require('./expectation')
    ,Promise = require('es6-promise').Promise
    ,util = require('util')
    ,EventEmitter  = require('events').EventEmitter
    ;

var expectations = []
function Response(cfg) {
    this.url = cfg.url
    this.statusCode = 0
    this.headers = {}
    this.body = undefined
    this.cfg = cfg

}
Response.prototype.setHeader = function(k,v) {
    this.headers[k] = v
}
Response.prototype.write = function(val) {
    this.body = val
}
Response.prototype.end = function(){
    this.ended = true
}

function Request(cfg) {
    EventEmitter.call(this)
    this.url = cfg.url
    this.headers = cfg.headers
    this.method = cfg.method
    this.data  = cfg.body
}
Request.prototype = new EventEmitter
Request.prototype.flush = function(){
    this.emit('data',this.data || '')
    this.emit('end')
}

function InMemoryHttp(){

}
InMemoryHttp.prototype.expect = function(cfg) {
    return new Promise(function(resolve, reject) {
        var it
        try {
            it = new Expectation(cfg)
            expectations.push(it)
        } catch(err) {
            return reject(err)
        }
        return resolve(it)
    })
}
InMemoryHttp.prototype.invoke = function(cfg) {
    cfg.url = (cfg.url || this.url(cfg))
    if(!cfg.body) {
        cfg.body = (cfg.data ? JSON.stringify(cfg.data) : undefined)
    }
    return new Promise(function(resolve, reject){
        var expectation = expectations.shift()

        if(!expectation) {
            var msg = util.format('Unknown request for %s with method %s',req.url,req.method)
            reject(new Error(msg))
        }
        var req = new Request(cfg)
            ,res = new Response(expectation.cfg)
        expectation.match(req, res).then(resolve.bind(res,res),reject)
        req.flush()
    }.bind(this))
}
InMemoryHttp.prototype.flush = function(cfg) {

}
module.exports = InMemoryHttp
