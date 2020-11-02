// Modulo di accesso al db mysql con xdevapi (di Oracle GPLv2)
// accessoDb.js esporta un metodo per leggere da tabella clienti per id
// 29/02/2020 Isidori Fabrizio 

//log4js = require('log4js');
var mysqlx = require('@mysql/xdevapi');

// constanti accesso db - TODO da file di config esterno
const userdb = 'root';
const pwddb = 'kodekode';
const hostdb = 'localhost';
const portdb = '3306';
const schemadb = 'wstunnel';
// per adesso lascio cablato nome tabella e relativi campi

// rendo la funzione esportabile (per uso come modulo esterno)
exports.cercaClient = function(client_id) //function cercaClient(client_id)
{ // provo funzione con promise 
 return new Promise((resolve, reject) =>
 {
   // appoggio righe estratte  
   var rows = [];   

   // Connect to server 
   mysqlx.getSession({ user: userdb, password: pwddb, host: hostdb, port: portdb })
   .then(session => {
                return session.getSchema(schemadb).getTable('client_list')
                    .select(['client_id', 'client_name', 'use_port'])
                    .where('client_id = :param')
                    .bind('param', client_id)
                    .execute(row => {
                       // abbiamo capito che entra qui solo se trova la tupla
		       rows.push(row); // copia le righe lette
                    })
                    .then(() => { 
		      // then viene eseguito temporalmente dopo execute	    
		      if (rows[0] != null) resolve(rows[0][2]);
		      else reject("Non presente!");
	     	      return session.close();
		    });
            })
            .catch(err => { reject(err); }); // qui esco con la reject
  }); // chiude promise

} // chiude function esportata
