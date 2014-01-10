var fs=require('fs');
var assert=require('assert');
var Login=new (require('./lib/login').INST)();


//如果账号是具有个人和公共主页双重身份的，
// 要登公共主页时把isPage设为true，其他情况都可不设isPage或设为false
var account={
    email:'账号',
    passwd:'密码',
    isPage:false
}
Login.setAccount(account);
//无cookie，密码登录
Login.onekeyLogin(function(err,info){
    assert.equal(true,info.logined);
    console.log('login from password.');
    fs.writeFileSync('info.txt',JSON.stringify(info,null,4), 'utf8');
    loginFromCookie();
});



//从持久化的cookie信息直接登录，不需要提交密码信息（如果发现cookie已经失效了，则会重新尝试密码登录）
function loginFromCookie(){
    var account=JSON.parse(fs.readFileSync('info.txt','utf8'));
    Login.setAccount(account);
    Login.onekeyLogin(function(err,info){
        assert.equal(true,info.logined);
        console.log('login from Json Cookie.');
        loginFromCookieJar(info.Cookie);
    });

}

//直接传cookiejar进去登录
function loginFromCookieJar(cookiejar){
    var account=JSON.parse(fs.readFileSync('info.txt','utf8'));
    account.Cookie=cookiejar;
    Login.setAccount(account);
    Login.onekeyLogin(function(err,info){
        assert.equal(true,info.logined);
        console.log('login from CookieJar.');
        console.log('Complete.');
    });

}