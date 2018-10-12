前后端分离的架构下，前端开发不全部依赖于后端的接口，当后端服务器不可用时，可以自己mock数据。

![](https://upload-images.jianshu.io/upload_images/5077517-9fd0eb992ec72bf7.png?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240)

主要针对异步的ajax请求，通过把对后端服务器的请求换成对mock server的请求来实现。这个操作可以在3个层次来做。

## 1. 项目中的httpProxy
前端项目一般都会封装一个httpProxy，进行一些ajax的通用配置和请求、响应的通用处理。我们可以通过切换请求域名的配置来实现mock server 和真实后端服务器的切换。

比如axios里，通过修改baseUrl的配置：
```
  axios.config({
      baseUrl: 'http://xxxxx.com/' 
  })
```
手动切换成
```
axios.config({
  baseUrl: 'http://localhost:3000/'
})
```
就可以把所有的请求都换成对mock server的请求了。

## 2.构建时的环境变量

手动切换的方式太过繁琐，我们可以结合构建时的环境变量来实现自动切换。

比如，在axios的配置中这样写：
```
axios.config({
   baseUrl: process.env.USE_MOCK ? 'http://xxxx.com' : ''
})
```
然后在启动的时候通过判断命令行参数，或者通过选择的方式来切换，
```
       inquirer.prompt({
            type: 'list',
            name: 'isMock',
            message: '是否使用mock数据？',
            choices: [
                '是',
                '否'
            ],
            filter(val) {
                return val === '是' ? 1 : 0;
            }
        }).then(answer => {
            if (answer.isMock === 1) {
                console.log(chalk.green('使用mock数据'));
                process.env.USE_MOCK = true;
            } else {
                console.log(chalk.green('不使用mock数据'));
            }
        });
```
这种通过命令行参数或者手动选择的方式，比手动修改代码方便了很多，也是比较常用的方式。
## 3.修改hosts
除了可以修改请求的域名外，还可以通过hosts来修改域名和ip的对应关系，不改动代码，只要把域名切换成后端服务器的ip或者mock server的ip就可以了。这种方式也很常用。

```json
# localhost   http://xxx.com
59.151.115.115 http://xxx.com
```

项目级别、工程级别、系统级别的方案都可以实现目标服务器的切换。除了直接请求目标服务器，也可以通过webpack的devServer来做转发，它支持一些url的重写之类的功能。

如把 /aaa/bbb 转向 /api/xxx的配置
```
devServer: {
  proxy:{
       '/aaa/bbb/': {
         target: 'http://localhost:3000',
         changeOrigin: true,
         pathRewrite: {
            '^/api/xxx': ''
        }
      }
  }
}
```
以上是3种mock数据的方式，最常用的还是在工程级别也就是构建的时候做处理，而且还可以做到检测mock  server状态并且自动启动mock server。

## 自动启动mock server

检测mock server状态可以通过 检测端口占用情况 
```
    exec('netstat -ano | findstr "3000"', (err, result) => {        
        if(result.indexOf('LISTENING') != -1){
            console.log(chalk.green('检测到mock服务器已经启动'));
        }else{
            console.log(chalk.blue('未启动mock服务器，正在启动中'));
            startMockServer( () => {
                console.log(chalk.green('mock服务器启动成功'));
            });
        }
    });
```
而启动MockServer只需要执行对应的命令。不过MockServer启动后就一直阻塞在哪里，没有返回的信息，只能通过主动去请求的方式来判断是否启动成功。
```
function startMockServer(callback) {
    exec('npm run mock', (err, stdout) => {
        if (err) {
            console.log(chalk.red('mock服务器启动失败'));
        }
    });
    setTimeout(() => {
        http.get({
            hostname: 'localhost',
            port: 3000,
            path: '/'
        }, (res) => {
            callback();
        });
    }, 3000);
}
```
最终效果如下：
![](https://upload-images.jianshu.io/upload_images/5077517-345393f97cbb1d2b.png?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240)

![](https://upload-images.jianshu.io/upload_images/5077517-e330f5a4e06778f2.png?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240)

上面的文字是用的cfonts和随机生成的配置

```
function generateRandomCFontsConfig() {
    const fontArr = ['console', 'block', 'simpleBlock', 'simple', '3d', 'simple3d', 'chrome', 'huge'];
    const font = fontArr[_.random(0,fontArr.length)];
    const colorArr = ['system','black','red','green','yellow','blue','magenta','cyan','white','gray','redBright','greenBright','yellowBright','blueBright','magentaBright','cyanBright','whiteBright','candy']
    const color1 = colorArr[_.random(0,colorArr.length-1)]
    const color2 = colorArr[_.random(0,colorArr.length-1)]
    const color3 = colorArr[_.random(0,colorArr.length-1)]

    return {
        colors: [color1,color2,color3],
        font: font
    }
}
    say('ITS',{
        ...generateRandomCFontsConfig(),
        space: false
    })
```

##总结

切换mock 服务器和真实的后端服务器，可以通过修改请求的域名或者通过修改hosts修改域名对应的ip的方式，修改域名的方式可以结合工程构建过程中的环境变量来实现自动切换，同时webpackDevServer也支持一些请求的转发。

工程构建过程中可以通过检测端口占用请求和http请求的方式 做到检测mock server状态和自动启动mock server，使得mock 数据变得更加简单。



