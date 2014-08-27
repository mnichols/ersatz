'use strict';

var Ersatz = require('../ersatz')
describe('Ersatz',function(){
    function copy(src,dest) {
        dest = dest || {}
        for(var k in src) {
            if(typeof src[k] === 'object') {
                dest[k] = copy(src[k])
            } else {
                dest[k] = src[k]
            }
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
            ,y: {
                request: {
                    url: '/y'
                    ,method: 'POST'
                    ,headers: {
                        'accept': 'application/hal+json'
                        ,'x-foo': 'bar'
                    }
                    ,body: {name: 'y'}
                    ,params: { good: 'param'}
                }
                ,response: {
                    statusCode: 200
                    ,body: { name: 'y'}
                    ,headers: {
                        'content-type': 'application/hal+json'
                    }
                }
            }
        }
    })
    describe('when invoking requests',function(){
        it('should resolve their responses',function(){
            var a,x;
            ersatz.expect(fixtures.a.request,fixtures.a.response)
            ersatz.expect(fixtures.x.request,fixtures.x.response)

            a = ersatz.invoke(fixtures.a.request)
            a.body.should.eql(fixtures.a.response.body)


            x = ersatz.invoke(fixtures.x.request)
            x.body.should.eql(fixtures.x.response.body)
        })
    })
    describe('when at least one expected request has not been made',function(){
        beforeEach(function(){

            return ersatz.expect(fixtures.a.request, fixtures.a.response)
        })
        it('should reject the verification',function(){
            ersatz.verify.bind(ersatz)
                .should.throw(/There are 1 pending requests/)
        })
    })
    describe('when all expected requests have been made',function(){
        beforeEach(function(){
            return ersatz.expect(fixtures.a.request, fixtures.a.response)
        })
        beforeEach(function(){
            return ersatz.invoke(fixtures.a.request)
        })
        it('should do nothing on verification',function(){
            return ersatz.verify()
                .should.be.ok
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

    describe('when request is made not meeting expectation',function(){
        beforeEach(function(){
            return ersatz.expect(fixtures.x.request,fixtures.x.response)
        })
        it('should reject when wrong url',function(){
            var req = copy(fixtures.x.request)
            req.url = '/bad-url'
            return ersatz.invoke.bind(ersatz,req).should
                .throw(/Expected request for \/x, but got \/bad-url/)
        })
        it('should reject when wrong method',function(){
            var req = copy(fixtures.x.request)
            req.method = 'GET'
            return ersatz.invoke.bind(ersatz,req).should
                .throw(/Expected request for \/x with method POST, but got method GET/)
        })
        it('should reject when wrong body',function(){
            var req = copy(fixtures.x.request)
            req.body = {name: 'FAIL'}
            return ersatz.invoke.bind(ersatz,req).should
                .throw(/Expected request for \/x to have body {\n  "name": "x"\n}, but got {\n  "name": "FAIL"\n}/)

        })
        it('should reject when wrong headers',function(){
            var req = copy(fixtures.x.request)
            req.headers = { 'accept':'text/plain'}
            return ersatz.invoke.bind(ersatz,req).should
                .throw(/Expected request for \/x to have header accept with value application\/hal\+json/)
        })
        it('should respond when all is matching',function(){
            var req = copy(fixtures.x.request)
            return ersatz.invoke(req)
                .should.deep.equal(fixtures.x.response)
        })
        it('should respond when extra headers exist',function(){
            var req = copy(fixtures.x.request)
            req.headers['x-booze'] = 'baz'
            return ersatz.invoke(req)
                .should.deep.equal(fixtures.x.response)
        })

    })
    describe('when params are mismatched',function(){
        it('should reject when nonexistent params',function(){

            ersatz.expect(fixtures.y.request,{})
            var req = copy(fixtures.y.request)
            req.url = req.url
            return ersatz.invoke.bind(ersatz,req).should
                .throw(/Expected request for \/y with params "good=param", but got "<NONE RECEIVED>"/)

        })
        it('should reject when wrong params',function(){

            ersatz.expect(fixtures.y.request,{})
            var req = copy(fixtures.y.request)
            req.url = req.url + '?bad=param'
            return ersatz.invoke.bind(ersatz,req).should
                .throw(/Expected request for \/y with params "good=param", but got "bad=param"/)

        })

    })

})
