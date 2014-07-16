'use strict';

var Ersatz = require('../ersatz')
describe('Ersatz',function(){
    function copy(src,dest) {
        dest = dest || {}
        for(var k in src) {
            dest[k] = src[k]
        }
        return dest
    }
    var ersatz
        ,fixtures
    beforeEach(function(){
        ersatz = new Ersatz()
    })
    beforeEach(function(){
        fixtures = {
            a: {
                request : {
                    url: '/a'
                    ,method: 'GET'
                    ,headers: {
                        'accept': 'application/hal+json'
                    }
                }
                ,response: {
                    statusCode: 200
                    ,headers: {
                        'content-type':'application/json'
                    }
                    ,body: JSON.stringify({name:'a'})
                }
            }
            ,c: {
                request: {
                    url: '/c'
                    ,method: 'GET'
                }
                ,response: {
                    statusCode: 200
                    ,headers: {
                        'content-type':'application/json'
                    }
                    ,body: ''
                }
            }
            ,x: {
                request: {
                    url: '/x'
                    ,method: 'POST'
                    ,headers: {
                        'accept': 'application/hal+json'
                        ,'x-foo': 'bar'
                    }
                    ,body: {name: 'x'}
                }
                ,response: {
                    statusCode: 200
                    ,body: { name: 'x'}
                    ,headers: {
                        'content-type': 'application/hal+json'
                    }
                }
            }
        }
    })
    describe('when queuing requests',function(){
        it('should resolve their responses',function(){
            var a,x;
            ersatz.expect(fixtures.a.request,fixtures.a.response)
            ersatz.expect(fixtures.x.request,fixtures.x.response)
            ersatz.enqueue(fixtures.a.request)
                .then(function(res){
                    a = res
                })
            ersatz.enqueue(fixtures.x.request)
                .then(function(res) {
                    x = res
                })
            return ersatz.flush()
                .then(function(){
                    a.body.should.eql(fixtures.a.response.body)
                    x.body.should.eql(fixtures.x.response.body)
                }).should.be.ok
        })
    })
    describe('when at least one expected request has not been made',function(){
        beforeEach(function(){

            return ersatz.expect(fixtures.a.request, fixtures.a.response)
        })
        it('should reject the flush',function(){
            return ersatz.flush()
                .then(ersatz.verify)
                .should.be.rejectedWith(/There are 1 pending requests/)
        })
    })
    describe('when printing',function(){
        it('should list expectations',function(){
            ersatz.expect(fixtures.a.request,fixtures.a.response)
            ersatz.expect(fixtures.x.request,fixtures.x.response)
            ersatz.expect(fixtures.c.request,fixtures.c.response)
            console.log(ersatz.printExpectations())
        })
    })
    describe('when all expected requests have been made',function(){
        beforeEach(function(){
            return ersatz.expect(fixtures.a.request, fixtures.a.response)
        })
        beforeEach(function(){
            return ersatz.invoke(fixtures.a.request)
        })
        it('should do nothing on flush',function(){
            return ersatz.flush()
                .then(ersatz.verify)
                .should.be.ok
        })
    })

    describe('when queued invocations fail upon flush',function(){
        beforeEach(function(){
            ersatz.expect(fixtures.a.request,fixtures.a.response)
            ersatz.expect(fixtures.x.request,fixtures.x.response)
            ersatz.expect(fixtures.c.request,fixtures.c.response)
        })
        beforeEach(function(){
            var bad = copy(fixtures.x.request)
            bad.url = '/bad-url'
            ersatz.enqueue(fixtures.a.request)
            ersatz.enqueue(bad)
        })
        it('should be rejected',function(){
            return ersatz.flush()
                .should
                .be.rejectedWith(/Expected request for \/x, but got \/bad-url/)
        })
    })
    describe('when queued invocations are not flushed',function(){
        beforeEach(function(){
            ersatz.expect(fixtures.x.request,fixtures.x.response)
        })
        beforeEach(function(){
            var req = copy(fixtures.x.request)
            req.url = '/bad-url'
            return ersatz.enqueue(req).should.be.ok
        })
        it('should be rejected',function(){
            return ersatz.verify()
                .should
                .be.rejectedWith(/There are 1 pending requests:/)
        })
    })
    describe('when request is made not meeting expectation',function(){
        beforeEach(function(){
            return ersatz.expect(fixtures.x.request,fixtures.x.response)
        })
        it('should reject when wrong url',function(){
            var req = copy(fixtures.x.request)
            req.url = '/bad-url'
            return ersatz.invoke(req).should
                .be.rejectedWith(/Expected request for \/x, but got \/bad-url/)
        })
        it('should reject when wrong method',function(){
            var req = copy(fixtures.x.request)
            req.method = 'GET'
            return ersatz.invoke(req).should
                .be.rejectedWith(/Expected request for \/x with method POST, but got method GET/)
        })
        it('should reject when wrong body',function(){
            var req = copy(fixtures.x.request)
            req.body = {name: 'FAIL'}
            return ersatz.invoke(req).should
                .be.rejectedWith(/Expected request for \/x to have body {\n  "name": "x"\n}, but got {\n  "name": "FAIL"\n}/)

        })
        it('should reject when wrong headers',function(){
            var req = copy(fixtures.x.request)
            req.headers = { 'accept':'text/plain'}
            return ersatz.invoke(req).should
                .be.rejectedWith(/Expected request for \/x to have header accept with value application\/hal\+json/)
        })
        it('should respond when all is matching',function(){
            var req = copy(fixtures.x.request)
            return ersatz.invoke(req)
                .should.eventually.deep.equal(fixtures.x.response)
        })

    })
    describe('when chaining all the things',function(){
        it('should fail as expected',function(){
            var req = copy(fixtures.x.request)
            req.method = 'GET'
            return ersatz.expect(fixtures.x.request, fixtures.x.response)
                .then(ersatz.enqueue(req))
                .then(ersatz.flush)
                .should
                .be.rejectedWith(/Expected request for \/x with method POST, but got method GET/)
        })
    })

})
