##renrenlogin

#登录人人网

#Install:

npm install renrenlogin

#Usage:

1.用账号密码登录

var fs=require('fs');

var Login=new (require('renrenlogin').INST)();


//如果账号是具有个人和公共主页双重身份的，

// 要登公共主页时把isPage设为true，其他情况都可不设isPage或设为false

var account={

    email:'账号',

    passwd:'密码',

    isPage:false

};

Login.setAccount(account);

Login.onekeyLogin(function(err,info){

    console.log(info.logined);

    //把登录后的用户信息保存到文件中

    fs.writeFileSync('info.txt',JSON.stringify(info,null,4), 'utf8');

});


2.从已保存到文件中的Cookie登录

//从持久化的cookie信息直接登录，不需要提交密码信息（如果发现cookie已经失效了，则会重新尝试密码登录）

function loginFromCookie(){

    var account=JSON.parse(fs.readFileSync('info.txt','utf8'));

    Login.setAccount(account);

    Login.onekeyLogin(function(err,info){

        console.log(info.logined);

    });

}


返回后的info中含有Cookie对象，这是request-5291模块的内置cookie管理器。

request-5291是基于request的模块，因为request的Cookie管理器cookie-jar有很多bug，所以开出了分支创建request-5291，替换掉了其中的Cookie管理器。

后续要发起请求时建议使用request-5291，只需把这个返回的Cookie设为request-5291的默认cookie即可。

var request=require('request-5291');

request=request.defaults({

    jar:info.Cookie

});

request('http://www.renren.com',function(){});

///...

有问题邮件我786647787@qq.com

