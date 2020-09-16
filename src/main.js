const axios = require('axios');
const moment = require('moment');
const { app, BrowserWindow, ipcMain } = require('electron');
const { networks } = require('bitcoinjs-lib');
const BigNumber = require('bignumber.js');
const { download } = require('electron-dl');
const Client = require('bitcoin-core');
const { bitcoinsToSatoshis } = require("unchained-bitcoin")

const { enumerate, getXPub, signtx, promptpin, sendpin } = require('./server/commands');
const { getRpcInfo } = require('./server/utils')
const { getDataFromMultisig, getDataFromXPub, getMultisigDescriptor } = require('./utils/transactions');

const path = require('path');

const currentBitcoinNetwork = 'TESTNET' in process.env ? networks.testnet : networks.bitcoin;

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;

let currentNodeConfig = undefined;

function createWindow() {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    backgroundColor: 'rgb(245, 247, 250)',
    transparent: true,
    frame: false,
    // icon: path.join(__dirname, '/assets/AppIcon.icns'),
    titleBarStyle: 'hidden',
    webPreferences: {
      nodeIntegration: false,
      preload: path.resolve(__dirname, 'preload.js')
    }
  });

  mainWindow.setTrafficLightPosition && mainWindow.setTrafficLightPosition({
    x: 10,
    y: 20
  })

  mainWindow.maximize();

  if ('DEVURL' in process.env) {
    // load dev url
    mainWindow.loadURL(`http://localhost:3001/`);
  } else {
    // load production url
    mainWindow.loadURL(`file://${__dirname}/../build/index.html`);
  }

  // Open the DevTools.
  // mainWindow.webContents.openDevTools();

  // mainWindow.once('ready-to-show', () => {
  //   mainWindow.show()
  // })

  // Emitted when the window is closed.
  mainWindow.on('closed', function () {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null
  })
}

const setupInitialNodeConfig = async () => {
  try {
    const nodeConfig = await getBitcoinCoreConfig();
    const nodeClient = new Client(nodeConfig);
    const blockchainInfo = await nodeClient.getBlockchainInfo();
    currentNodeConfig = nodeConfig
  } catch (e) {
    return Promise.reject('setupInitialNodeConfig: Error connecting to Bitcoin Core, using Blockstream')
  }
}

async function getBitcoinCoreConfig() {
  const rpcInfo = await getRpcInfo();

  // TODO: check for testnet
  if (rpcInfo) {
    try {
      const nodeConfig = {
        username: rpcInfo.rpcuser,
        password: rpcInfo.rpcpassword,
        port: rpcInfo.rpcport || '8332',
        version: '0.20.0'
      }
      return Promise.resolve(nodeConfig);
    } catch (e) {
      return Promise.reject('getBitcoinCoreConfig: RPC Info invalid. Make sure node is running.')
    }
  }
  return Promise.reject('getBitcoinCoreConfig: No RPC Info found')
}

const getBitcoinCoreBlockchainInfo = async () => {
  try {
    const nodeConfig = await getBitcoinCoreConfig() // this changes currentNodeConfig
    const nodeClient = new Client(nodeConfig);
    const blockchainInfo = await nodeClient.getBlockchainInfo();
    blockchainInfo.provider = 'Bitcoin Core';
    blockchainInfo.connected = true;
    return Promise.resolve(blockchainInfo);
  } catch (e) {
    return Promise.reject();
  }
}

const getBlockstreamBlockchainInfo = async () => {
  try {
    const data = await (await axios.get(`https://blockstream.info/api/blocks/tip/height`)).data;
    let blockchainInfo = {};
    blockchainInfo.blocks = data;
    blockchainInfo.initialblockdownload = false;
    blockchainInfo.provider = 'Blockstream';
    blockchainInfo.connected = true;
    return Promise.resolve(blockchainInfo)
  } catch (e) {
    return Promise.reject()
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

app.on('ready', setupInitialNodeConfig);

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit()
  }
});

app.on('activate', function () {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow()
  }
});

ipcMain.on('/account-data', async (event, args) => {
  const { config } = args;
  let addresses, changeAddresses, transactions, unusedAddresses, unusedChangeAddresses, availableUtxos;
  let nodeClient = undefined;
  console.log('/account-data currentNodeConfig: ', currentNodeConfig);
  try {
    if (currentNodeConfig) {
      const nodeClient = new Client({
        username: currentNodeConfig.rpcuser,
        password: currentNodeConfig.rpcpassword,
        version: '0.20.0'
      });

      console.log('/account-data nodeClient: ', nodeClient);
      console.log('/account-data xxx: ', await nodeClient.getBlockchainInfo());

      const walletList = await nodeClient.listWallets();
      console.log('walletList: ', walletList);

      if (!walletList.includes(config.name)) {
        try {
          const walletResp = await nodeClient.loadWallet({ filename: config.name });
          console.log('walletResp: ', walletResp);
        } catch (e) { // if failed to load wallet, then probably doesnt exist so let's create one and import
          console.log('hits catch: ', e);
          await nodeClient.createWallet({ wallet_name: config.name });
          console.log('after createWallet: ', config)
          if (config.quorum.totalSigners === 1) {
            for (let i = 0; i < 1000; i++) {
              const receiveAddress = getAddressFromAccount(config, `m / 0 / ${i} `, currentBitcoinNetwork)
              const changeAddress = getAddressFromAccount(config, `m / 1 / ${i} `, currentBitcoinNetwork)

              await client.importAddress({
                address: receiveAddress,
                rescan: false
              });

              await client.importAddress({
                address: changeAddress,
                rescan: i === 999 ? true : false
              });

            }

          } else { // multisig
            //  import receive addresses
            await client.importMulti({
              desc: getMultisigDescriptor(nodeClient, config.quorum.requiredSigners, config.extendedPublicKeys, true),
              range: [0, 1000]
            });

            // import change
            await client.importMulti({
              desc: getMultisigDescriptor(nodeClient, config.quorum.requiredSigners, config.extendedPublicKeys, false),
              range: [0, 1000]
            });
          }
        }
      }
    }

    if (config.quorum.totalSigners > 1) {
      [addresses, changeAddresses, transactions, unusedAddresses, unusedChangeAddresses, availableUtxos] = await getDataFromMultisig(config, nodeClient, currentBitcoinNetwork);
    } else {
      [addresses, changeAddresses, transactions, unusedAddresses, unusedChangeAddresses, availableUtxos] = await getDataFromXPub(config, nodeClient, currentBitcoinNetwork);
    }

    const currentBalance = availableUtxos.reduce((accum, utxo) => accum.plus(utxo.value), BigNumber(0));

    const accountData = {
      name: config.name,
      config: config,
      addresses,
      changeAddresses,
      availableUtxos,
      transactions,
      unusedAddresses,
      currentBalance: currentBalance.toNumber(),
      unusedChangeAddresses
    };

    event.reply('/account-data', accountData);

  } catch (e) {
    console.log('e: ', e);
  }
});

ipcMain.handle('download-item', async (event, { url, filename }) => {
  try {
    const win = BrowserWindow.getFocusedWindow();
    await download(win, url, { filename });
    return Promise.reject(true)
  } catch (e) {
    return Promise.reject(false)
  }
});

ipcMain.handle('/bitcoin-network', async (event, args) => {
  return Promise.resolve(currentBitcoinNetwork)
});

ipcMain.handle('/historical-btc-price', async (event, args) => {
  let historicalBitcoinPrice = await (await axios.get(`https://api.coindesk.com/v1/bpi/historical/close.json?start=2014-01-01&end=${moment().format('YYYY-MM-DD')}`)).data;
  historicalBitcoinPrice = historicalBitcoinPrice.bpi;
  let priceForChart = [];
  for (let i = 0; i < Object.keys(historicalBitcoinPrice).length; i++) {
    priceForChart.push({
      price: Object.values(historicalBitcoinPrice)[i],
      date: Object.keys(historicalBitcoinPrice)[i]
    })
  }
  return Promise.resolve(priceForChart);
});

ipcMain.handle('/enumerate', async (event, args) => {
  const resp = JSON.parse(await enumerate());
  if (resp.error) {
    return Promise.reject(new Error('Error enumerating hardware wallets'))
  }
  const filteredDevices = resp.filter((device) => {
    return device.type === 'coldcard' || device.type === 'ledger' || device.type === 'trezor';
  })
  return Promise.resolve(filteredDevices);
});

ipcMain.handle('/xpub', async (event, args) => {
  const { deviceType, devicePath, path } = args;
  const resp = JSON.parse(await getXPub(deviceType, devicePath, path)); // responses come back as strings, need to be parsed
  if (resp.error) {
    return Promise.reject(new Error('Error extracting xpub'));
  }
  return Promise.resolve(resp);
});

ipcMain.handle('/sign', async (event, args) => {
  const { deviceType, devicePath, psbt } = args;
  const resp = JSON.parse(await signtx(deviceType, devicePath, psbt));
  if (resp.error) {
    return Promise.reject(new Error('Error signing transaction'));
  }
  return Promise.resolve(resp);
});

ipcMain.handle('/promptpin', async (event, args) => {
  const { deviceType, devicePath } = args;
  const resp = JSON.parse(await promptpin(deviceType, devicePath));
  if (resp.error) {
    return Promise.reject(new Error('Error prompting pin'));
  }
  return Promise.resolve(resp);
});

ipcMain.handle('/sendpin', async (event, args) => {
  const { deviceType, devicePath, pin } = args;
  const resp = JSON.parse(await sendpin(deviceType, devicePath, pin));
  if (resp.error) {
    return Promise.reject(new Error('Error sending pin'));
  }
  return Promise.resolve(resp);
});

ipcMain.handle('/estimateFee', async (event, args) => {
  if (currentNodeConfig.provider === 'Blockstream') {
    try {
      feeRates = await (await axios.get('https://mempool.space/api/v1/fees/recommended')).data; // TODO: should catch if URL is down
    } catch (e) {
      throw new Error('Error retrieving fees from mempool.space. Please try again.')
    }
    return Promise.resolve(feeRates);
  } else {
    const nodeClient = new Client(currentNodeConfig);
    try {
      const feeRates = {
        fastestFee: undefined,
        halfHourFee: undefined,
        hourFee: undefined
      }
      const fastestFeeRate = await nodeClient.estimateSmartFee(1).feerate;
      feeRates.fastestFee = BigNumber(fastestFeeRate).multipliedBy(100000).integerValue(BigNumber.ROUND_CEIL).toNumber(); // TODO: this probably needs relooked at
      const halfHourFeeRate = await nodeClient.estimateSmartFee(3).feerate;
      feeRates.halfHourFee = BigNumber(halfHourFeeRate).multipliedBy(100000).integerValue(BigNumber.ROUND_CEIL).toNumber(); // TODO: this probably needs relooked at
      const hourFeeRate = await nodeClient.estimateSmartFee(6).feerate;
      feeRates.hourFee = BigNumber(hourFeeRate).multipliedBy(100000).integerValue(BigNumber.ROUND_CEIL).toNumber(); // TODO: this probably needs relooked at

      return Promise.resolve(feeRates);
    } catch (e) {
      return Promise.reject(new Error('Error retrieving fee'));
    }
  }

});

ipcMain.handle('/broadcastTx', async (event, args) => {
  const { walletName, txHex } = args;
  try {
    currentNodeConfig.wallet = walletName
    const nodeClient = new Client(currentNodeConfig);
    const resp = await nodeClient.sendRawTransaction(txHex);
    return Promise.resolve(resp);
  } catch (e) {
    return Promise.reject(new Error('Error broadcasting transaction'));
  }
});

ipcMain.handle('/changeNodeConfig', async (event, args) => {
  const { nodeConfig } = args;
  console.log('/changeNodeConfig currentNodeConfig: ', currentNodeConfig);
  console.log('/changeNodeConfig nodeConfig: ', nodeConfig);
  if (nodeConfig.provider === 'Bitcoin Core') {
    try {
      currentNodeConfig = await getBitcoinCoreConfig();
      const blockchainInfo = await getBitcoinCoreBlockchainInfo();
      return Promise.resolve(blockchainInfo);
    } catch (e) {
      const blockchainInfo = {
        connected: false,
        provider: 'Bitcoin Core'
      }
      return Promise.resolve(blockchainInfo);
    }
  } else if (nodeConfig.provider === 'Blockstream') {
    try {
      currentNodeConfig = undefined;
      const blockchainInfo = await getBlockstreamBlockchainInfo();
      return Promise.resolve(blockchainInfo);
    } catch (e) {
      const blockchainInfo = {
        connected: false,
        provider: 'Blockstream'
      }
      return Promise.resolve(blockchainInfo);
    }
  } else { // custom
    try {
      const nodeClient = new Client(nodeConfig);
      const blockchainInfo = await nodeClient.getBlockchainInfo();
      blockchainInfo.provider = 'Custom Node'
      blockchainInfo.connected = true;
      currentNodeConfig = nodeConfig;
      return Promise.resolve(blockchainInfo);
    } catch (e) {
      const blockchainInfo = {
        connected: false,
        provider: 'Custom Node'
      }
      return Promise.resolve(blockchainInfo);
    }
  }
});

ipcMain.handle('/getNodeConfig', async (event, args) => {
  console.log('/getNodeConfig currentNodeConfig: ', currentNodeConfig)
  if (currentNodeConfig) {
    try {
      const blockchainInfo = await getBitcoinCoreBlockchainInfo();
      return Promise.resolve(blockchainInfo);
    } catch (e) {
      const blockchainInfo = {
        connected: false,
        provider: 'Bitcoin Core'
      }
      return Promise.resolve(blockchainInfo);
    }
  } else {
    try {
      const blockchainInfo = await getBlockstreamBlockchainInfo();
      return Promise.resolve(blockchainInfo);
    } catch (e) {
      const blockchainInfo = {
        connected: false,
        provider: 'Blockstream'
      }
      return Promise.resolve(blockchainInfo);
    }
  }
});