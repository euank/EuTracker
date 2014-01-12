module.exports = {
   port: 33300, //This is the port all activity will occur on
   announceUrl: '/announce',
   scrapeUrl: '/scrape',
   secret: "yourLongSecretHere", //This is the secret used to whitelist torrents in private mode. 
   privateMode: false, //If true then only "registered" torrents will be allowed
   storeSession: true, //Save current peers / torrents in case of crash or restart
   bind: "0.0.0.0", //127.0.0.1 and then using nginx to connect would be a decent balancing plan
   announceTime: 20, //Time in minutes. Decimals are fine.
   minAnnounceTime: 10, //Time in minutes. Decimals are fine.
   peerCleanTime: 40, //Time in minutes before a peer is removed from the list
   peerCleanTime: 40, //Time in minutes before a peer is removed from the list
   trackerId: "No Idea"
}
