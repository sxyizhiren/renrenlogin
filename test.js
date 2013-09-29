var fs=require('fs');
var Login=new (require('./lib/login').INST)();


//如果账号是具有个人和公共主页双重身份的，
// 要登公共主页时把isPage设为true，其他情况都可不设isPage或设为false
var account={
    email:'账号',
    passwd:'密码',
    isPage:false
}
Login.setAccount(account);
Login.onekeyLogin(function(err,info){
    console.log(info.logined);
    fs.writeFileSync('info.txt',JSON.stringify(info,null,4), 'utf8');
    loginFromCookie();
});



//从持久化的cookie信息直接登录，不需要提交密码信息（如果发现cookie已经失效了，则会重新尝试密码登录）
function loginFromCookie(){
    var account=JSON.parse(fs.readFileSync('info.txt','utf8'));
    Login.setAccount(account);
    Login.onekeyLogin(function(err,info){
        console.log(info.logined);
        console.log('Complete.');
    });

}