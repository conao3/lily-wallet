import moment from 'moment';
import { v4 as uuidv4 } from 'uuid';
import { networks, Psbt } from 'bitcoinjs-lib';

const getUnchainedNetworkFromBjslibNetwork = (bitcoinJslibNetwork) => {
  if (bitcoinJslibNetwork === networks.bitcoin) {
    return 'mainnet';
  } else {
    return 'testnet';
  }
}

// TODO: move this somewhere more logical
export const combinePsbts = (finalPsbt, signedPsbts) => {
  const psbt = finalPsbt;
  const base64SignedPsbts = signedPsbts.map((psbt) => {
    if (typeof psbt === 'object') {
      return psbt;
    } else {
      return Psbt.fromBase64(psbt);
    }
  })
  if (base64SignedPsbts.length) { // if there are signed psbts, combine them
    psbt.combine(...base64SignedPsbts);
  }
  return psbt;
}

export const downloadFile = (file, filename) => {
  const fileUrl = URL.createObjectURL(file);

  window.ipcRenderer.send('download-item', { url: fileUrl, filename: filename })
}

export const createConfigFile = (importedDevices, accountName, config, currentBitcoinNetwork) => {
  const configCopy = { ...config };
  configCopy.isEmpty = false;

  const newKeys = importedDevices.map((device) => {
    return {
      id: uuidv4(),
      created_at: Date.now(),
      parentFingerprint: device.fingerprint,
      network: getUnchainedNetworkFromBjslibNetwork(currentBitcoinNetwork),
      bip32Path: "m/0",
      xpub: device.xpub,
      device: {
        type: device.type,
        model: device.model,
        fingerprint: device.fingerprint
      }
    }
  });

  configCopy.vaults.push({
    id: uuidv4(),
    created_at: Date.now(),
    name: accountName,
    network: getUnchainedNetworkFromBjslibNetwork(currentBitcoinNetwork),
    addressType: "P2WSH",
    quorum: {
      requiredSigners: 2,
      totalSigners: 3
    },
    extendedPublicKeys: newKeys
  })

  configCopy.keys.push(...newKeys);

  return configCopy;
}

export const createColdCardBlob = (importedDevices) => {
  return new Blob([`# Coldcard Multisig setup file (created by Lily Wallet on ${moment(Date.now()).format('MM/DD/YYYY')})
#
Name: ColdcardKitchen
Policy: 2 of 3
Derivation: m/48'/0'/0'/2'
Format: P2WSH
${importedDevices.map((device) => (
    `\n${device.fingerprint || device.parentFingerprint}: ${device.xpub}`
  ))}
`], { type: 'text/plain' });
}