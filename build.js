'use strict'
//当前环境为开发环境
process.env.NODE_ENV = 'development'
const chalk = require('chalk')
const electron = require('electron')
const path = require('path')
const inquirer = require('inquirer');
const { say } = require('cfonts')
const { spawn, exec } = require('child_process')
const _ = require('lodash')
const http = require('http');
const webpack = require('webpack')
const WebpackDevServer = require('webpack-dev-server')
const webpackHotMiddleware = require('webpack-hot-middleware')

const webpackConfig = require('./webpack.renderer.config.js');
let hotMiddleware

function startBuild() {
    return new Promise((resolve, reject) => {
        const compiler = webpack(webpackConfig)
        hotMiddleware = webpackHotMiddleware(compiler, {
            log: false,
            heartbeat: 1000
        })

        compiler.plugin('compilation', compilation => {
            compilation.plugin('html-webpack-plugin-after-emit', (data, cb) => {
                hotMiddleware.publish({ action: 'reload' })
                cb && cb()
            })
        })

        compiler.plugin('done', stats => {
        })

        const server = new WebpackDevServer(compiler, {
            contentBase: path.join(__dirname, '../'),
            quiet: true,
            before(app, ctx) {
                app.use(hotMiddleware)
                ctx.middleware.waitUntilValid(() => {
                    resolve()
                })
            },
            proxy: {
                '/aaa/bbb': {
                    target: 'http://localhost:3000',
                    changeOrigin: true,
                    pathRewrite: {
                        '^/api/xxx': ''
                    }
                }
            }
        })

        server.listen(9080)
    })
}

function startMain() {
    return new Promise((resolve, reject) => {
        mainConfig.entry.main = [
            path.join(__dirname, '../src/main/index.dev.js')
        ].concat(mainConfig.entry.main)
        mainConfig.mode = 'development'
        const compiler = webpack(mainConfig)

        compiler.plugin('watch-run', (compilation, done) => {
            logStats('Main', chalk.white.bold('compiling...'))
            hotMiddleware.publish({ action: 'compiling' })
            done()
        })

        compiler.watch({}, (err, stats) => {
            if (err) {
                console.log(err)
                return
            }

            logStats('Main', stats)

            if (electronProcess && electronProcess.kill) {
                manualRestart = true
                process.kill(electronProcess.pid)
                electronProcess = null
                startElectron()

                setTimeout(() => {
                    manualRestart = false
                }, 5000)
            }

            resolve()
        })
    })
}

function startMock() {
    exec('npm run mock', function(error, stdout, stderr) {
        if (error) {
            electronLog(error, 'yellow')
        }
    })
}

function startElectron() {
    electronProcess = spawn(electron, [
        '--inspect=5858',
        path.join(__dirname, '../dist/electron/main.js')
    ])

    electronProcess.stdout.on('data', data => {
        electronLog(data, 'blue')
    })
    electronProcess.stderr.on('data', data => {
        electronLog(data, 'red')
    })

    electronProcess.on('close', () => {
        if (!manualRestart) process.exit()
    })
}

function electronLog(data, color) {
    let log = ''
    data = data.toString().split(/\r?\n/)
    data.forEach(line => {
        log += `  ${line}\n`
    })
    if (/[0-9A-z]+/.test(log)) {
        console.log(
            chalk[color].bold('┏ Electron -------------------') +
            '\n\n' +
            log +
            chalk[color].bold('┗ ----------------------------') +
            '\n'
        )
    }
}

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

function startMockServer(resolve, callback) {
    exec('npm run mock', (err, stdout) => {
        if (err) {
            console.log(chalk.red('mock服务器启动失败'));
            resolve();
        }
    });
    setTimeout(() => {
        http.get({
            hostname: 'localhost',
            port: 3000,
            path: '/'
        }, (res) => {
            callback();
            resolve();
        });
    }, 3000);
}

function checkMockServerStatus(resolve) {
    process.env.USE_MOCK = true;
    exec('netstat -ano | findstr "3000"', (err, result) => {
        
        if(result.indexOf('LISTENING') != -1){
            console.log(chalk.green('检测到mock服务器已经启动'));
            resolve();
        }else{
            console.log(chalk.blue('未启动mock服务器，正在启动中'));
            startMockServer(resolve, () => {
                console.log(chalk.green('mock服务器启动成功'));
            });
        }
    });
}

function greeting() {
    say('ITS',{
        ...generateRandomCFontsConfig(),
        space: false
    })

    return new Promise((resolve, reject) => {
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
                console.log(chalk.green('使用mock数据，检测mock服务器状态'));
                checkMockServerStatus(resolve);
            } else {
                console.log(chalk.green('不使用mock数据'));
                resolve();
            }
        });
    })
}

function init() {
    greeting().then(() => {
       startBuild();
    })
}

init()