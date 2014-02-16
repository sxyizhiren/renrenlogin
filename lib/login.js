var fs=require('fs');
var RSATool=require('simple-rsa');  //自己的库
var Requester=require('request');
var Request=Requester;//Request可被改变
var Step=require('step');
var toughCookie=require('tough-cookie');
var CookiePair=toughCookie.Cookie;
var assert=require('assert');


var Login=function(){
    var accountInfo;    //账户信息
    var encryptkey;     //rsa加密参数
    var captcha;        //是否需要验证码
    var icode;          //验证码
    var uname;          //账户信息
    var homepage;       //主页的html
    var token;          //页面的token
    var loginInfo;      //登陆信息
    var otherAccounts;  //其他用户身份信息【switchAccount】
    var pageState;      //页面状态【switchAccount】
    var newAccount;     //切换到另一用户身份【switchAccount】
    var callbackFn;     //登录后的回调函数if
    var userCookie;     //cookie对象，cookie管理器，多次登录重用该对象

    var noop=function(){};
    //轻量断言，失败就返回登录失败
    var lightAssert=function(yes,str){
        if(!yes){
            var err=new Error((str || 'RenRen Login Error'));
            assert(typeof callbackFn === 'function');
            callbackFn(err);
            //避免再次回调
            callbackFn=noop;
        }
    }

    //返回一个赋值完再回调的闭包函数
    var requestCallback=function(targetObject,callback){
        return function(error,response,body){
            if(!error && (response.statusCode === 200) && body){
                targetObject.health=true;
                targetObject.content=body;
                targetObject.href=response.request.uri.href;
                callback(null);
            }else{
                console.log('request error:'+error||response.statusCode);
                targetObject.health=false;
                callback(error || response.statusCode);
            }
        }

    };

    /**
     * 把json形式的对象转成用toughCookie.Cookie表示的对象
     * @param storeIdx
     */
    var makeJsonToCookieObject=function(storeIdx){
        if(typeof storeIdx !== 'object'){
            storeIdx = {};
        }
        Object.keys(storeIdx).forEach(function(domain){
            var domainGroup=storeIdx[domain];
            Object.keys(domainGroup).forEach(function(path){
                var pathGroup=domainGroup[path];
                Object.keys(pathGroup).forEach(function(key){
                    var obj=pathGroup[key];
                    obj.expires=toughCookie.parseDate(obj.expires);
                    obj.creation=toughCookie.parseDate(obj.creation);
                    obj.lastAccessed=toughCookie.parseDate(obj.lastAccessed);
                    pathGroup[key]=new CookiePair(obj);
                });
            });
        });
    }

    /**
     * 设置登录的账户
     * @param account
     */
    this.setAccount=function(account){
        accountInfo={};
        accountInfo.email=account.email || '';
        accountInfo.passwd=account.passwd || '';
        accountInfo.isPage = (true == account.isPage) ? true : false;

        //判断是否是CookieJar的实例，用instanceof判断不行，只能判断关键的功能函数是否存在
        if(typeof account.Cookie === 'object' && account.Cookie.setCookie && account.Cookie.getCookieString){
            //支持直接传cookiejar实例进来
            userCookie = account.Cookie;
        }else{
            if(!userCookie){
                userCookie = Requester.jar();
            }
            //json形式的cookie信息，从文件中读取出来的
            if(account.Cookie && account.Cookie.store && account.Cookie.store.idx){
                makeJsonToCookieObject(account.Cookie.store.idx);
                userCookie.store.idx=account.Cookie.store.idx;
            }
        }

        //cookeie可能已经更新，重建一个request
        Request=Requester.defaults({
            jar:userCookie,
            headers: {
              'user-agent': 'Mozilla/5.0 (Windows NT 5.1; rv:19.0) Gecko/20100101 Firefox/19.0'
              ,'Accept-Language': 'zh-cn'
              ,'Referer':'www.renren.com'
            }
        });

        accountInfo.Cookie = userCookie;
    }

    /**
     * 尝试cookie是否有效
     */
    var testCookie=function(){
        //console.log('stepCookieLogin');
        uname={};
        Step(
            function(){
                var url='http://notify.renren.com/wpi/getonlinecount.do';
                Request({url:url,json:true},requestCallback(uname,this));
            },
            function(){
                //解析json正确
                if(uname.health && uname.content.hostid > 0){
                    console.log('Cookie LOGIN OK!');
                    //console.log(uname);
                    loginInfo.content={
                        code:true,
                        homeUrl:'http://www.renren.com/home'
                    };
                    //浏览主页解析token，等后续操作
                    browserHomepage();
                }else{
                    console.log('Cookie Invalid!');
                    //console.log(uname);
                    //cookie无效，重新登录
                    ajaxLogin();
                }
            }
        );

    };



    /**
     * 设置RSA加密的参数
     */
    var getEncryptKey=function(){
        //console.log('stepEncryptKey');
        encryptkey={};
        var url='http://login.renren.com/ajax/getEncryptKey';
        Request({url:url,json:true},requestCallback(encryptkey,this));

    }

    /**
     * 检测该账号是否需要验证码
     */
    var getCaptcha=function(){
        //console.log('stepCaptcha');
        captcha={};
        var postData={
            'email': accountInfo.email
        };
        var url='http://www.renren.com/ajax/ShowCaptcha';

        Request.post({url:url,form:postData},requestCallback(captcha,this));
    }

    /**
     * 获取用户输入验证码
     * @param getter
     * @param callbackfn
     */
    function getInputIcode(getter,callbackfn){
        process.stdin.resume();
        process.stdin.setEncoding('utf8');

        process.stdin.on('data', function (chunk) {
            process.stdout.write('data: ' + chunk);
            var codeLen=4;
            getter.str=chunk.substr(0,codeLen);
            process.stdin.pause();
            callbackfn();
        });

        process.stdin.on('end', function () {
            process.stdout.write('end');
            process.stdin.pause();
        });
    }

    /**
     * 取验证吗图片，以及读取用户输入的验证码
     */
    var getICode=function(){
        //console.log('stepICode');

        icode={str:''};
        var __this=this;
        if(1==captcha.content || 4==captcha.content){
            Step(
                function(){
                    var url='http://icode.renren.com/getcode.do?t=web_login&rnd='+Math.random();
                    Request({url:url,encoding:null},requestCallback(icode,this));
                },
                function(){
                    fs.writeFile('icode.png', icode.content, 'binary',this);
                },
                function(){
                    console.log('输入验证码，请看当前目录下的icode.png');
                    getInputIcode(icode,__this);
                }
            );
        }else{
            //遇到过账号被封的，这个值就不是0了
            assert(0==captcha.content,'unknown capture content!');
            __this();
        }

    }

    /**
     * 前期工作准备好后，提交登录信息
     */
    var login=function(){
        //console.log('stepLogin');
        assert(accountInfo);
        var pass=accountInfo.passwd;
        if(encryptkey.content && encryptkey.content.isEncrypt){
            //encodeURIComponent可以转化中文成基本字符
            pass=RSATool.Encryptor(encryptkey.content.e,encryptkey.content.n)(encodeURIComponent(pass));
        }

        var postData={
            'email': accountInfo.email,
            'origURL': 'http://www.renren.com/home',
            'icode': icode.str,
            'domain': 'renren.com',
            'key_id': 1,
            'captcha_type': 'web_login',
            'password': pass,
            'rkey': encryptkey.content.rkey
        };

        var url = 'http://www.renren.com/ajaxLogin/login?1=1&uniqueTimestamp='+Math.random();

        Request.post({url:url,json:true,form:postData},requestCallback(loginInfo,this));
    }

    /**
     * 密码步骤步骤
     */
    var ajaxLogin=function(){
        Step(
            getEncryptKey,
            getCaptcha,
            getICode,
            login,
            browserHomepage
        );
    }

    /**
     * Cookie登录步骤
     */
    var cookieLogin=function(){
        testCookie();
    }
    /**
     * 留言home页面，便于提取token
     * 这一步很关键，承前启后
     */
    var browserHomepage=function(){
        //console.log('stepHomepage');
        homepage={};
        homepage.url=loginInfo.content.homeUrl;
        accountInfo.logined=loginInfo.content.code;//用于外部判断是否登录成功
        lightAssert(true === accountInfo.logined,'Password Or Captcha Not Match');
        //Request内部处理了所有的跳转
        //homepage.url是跳转前的
        Request(homepage.url,requestCallback(homepage,function(){
            //更新url
            homepage.url=homepage.health?homepage.href:homepage.url;
            switchUser();
        }));
    }


    /**
     * 切换用户步骤
     */
    var switchUser=function(){
        Step(
            getUname,
            parseToken,
            getOtherAccount,
            getOtherPageState,
            switchNewAccount,
            checkNewAccount
        );
    }

    /**
     * 获取id和name，公共主页的name和id一样，获取不到
     */
    var getUname=function(){
        //console.log('stepUname');
        uname={};
        assert(accountInfo);
        var url='http://notify.renren.com/wpi/getonlinecount.do';
        Request({url:url,json:true},requestCallback(uname,this));
    }

    /**
     * 从home的html中解析出token
     */
    var parseToken=function(){
        //console.log('stepToken');
        token={};
        html=homepage.content;
        var tokenREG=/\{get_check:'(.+)',get_check_x:'(.+)',env:\{/;
        var ret;
        if(ret=tokenREG.exec(html)){
            token.requestToken=ret[1];
            token._rtk=ret[2];
            console.log('token:requestToken['+token.requestToken+'],_rtk['+token._rtk+']');
        }else{
            console.log('get token error!');
            token.requestToken='';
            token._rtk='';
        }
        //token获取不到会一直发不出状态
        lightAssert(''!=token.requestToken && ''!=token._rtk);
        this();
    }


    /**
     * 读取别的账号，用户切换普通账号和公共主页
     */
    var getOtherAccount=function(){
        //console.log('stepOtherAccounts');
        otherAccounts={};
        var url='http://www.renren.com/getOtherAccounts';
        Request({url:url,json:true},requestCallback(otherAccounts,this));
    }

    /**
     * 读取账户的状态信息，切换账号时要检测它的值
     */
    var getOtherPageState=function(){
        //console.log('stepPageState');
        pageState={};
        //console.log(otherAccounts);
        var needSwitch = (otherAccounts.content && (String(accountInfo.isPage) != otherAccounts.content.self_isPage)
            && otherAccounts.content.otherAccounts && otherAccounts.content.otherAccounts[0])?true:false;
        pageState.needSwitch=needSwitch;
        if(needSwitch){
            console.log('Need to switch account!');
            var pids=otherAccounts.content.otherAccounts[0].transId;
            var url='http://page.renren.com/api/pageState';

            var postData={
                '_rtk': token._rtk,
                'pids':pids,
                'requestToken':token.requestToken
            };

            Request.post({url:url,json:true,form:postData},requestCallback(pageState,this));
        }else{
            //console.log('Need NOT to switch account!');
            this();
        }
    }

    /**
     * (确认要切换后)执行切换普通用户和主页的身份
     */
    var switchNewAccount=function(){
        //console.log('stepNewAccount');
        newAccount={};

        if(pageState.needSwitch && pageState.content && (pageState.content.code == 0)){
            var destId=otherAccounts.content.otherAccounts[0].id;
            var url='http://www.renren.com/switchAccount';

            var postData={
                '_rtk': token._rtk,
                'destId': destId ,
                'origUrl':homepage.url,
                'requestToken':token.requestToken
            };

            Request.post({url:url,json:true,form:postData},requestCallback(newAccount,this));
        }else{
            this();
        }
    }

    /**
     * 检测是否切换成功，成功后重新读取home页面
     */
    var checkNewAccount=function(){
        //console.log('stepCheckNewAccount');
        //console.log(newAccount);
        if(newAccount.content && newAccount.content.isJump){
            loginInfo.content.homeUrl=newAccount.content.url;
            //用户切换后重新解析token，登录状态logined不变
            browserHomepage();
        }else{
            assert(typeof callbackFn === 'function');
            accountInfo.token=token;
            accountInfo.homeUrl=homepage.url;
            accountInfo.uid=getUid(accountInfo);
            callbackFn(null,accountInfo);
        }

    }

    /**
     * 获取用户id，在uname中的不是有用的id，
     * 这里先从home链接中提取，失败再从cookie中提取
     * @return {*}
     */
    var getUid=function(accountInfo){
        var uidReg;
        var ret;
        uidReg=/www\.renren\.com\/([\d]+)/;
        ret=uidReg.exec(accountInfo.homeUrl);
        if(ret){
            return ret[1];
        }else{
            uidReg=/feedType=([\d]+)_hot/;
            ret=uidReg.exec(accountInfo.Cookie.store.idx['www.renren.com']['/']['feedType'].cookieString());
            if(ret){
                return ret[1];
            }
        }
        return '';
    }

    this.onekeyLogin=function(callback){
        assert(typeof callback === 'function');
        callbackFn=callback;
        loginInfo={};   //初始化
        cookieLogin();
    }

}

module.exports.INST=Login;


