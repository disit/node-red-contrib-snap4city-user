/* NODE-RED-CONTRIB-SNAP4CITY-USER
   Copyright (C) 2018 DISIT Lab http://www.disit.org - University of Florence

   This program is free software: you can redistribute it and/or modify
   it under the terms of the GNU Affero General Public License as
   published by the Free Software Foundation, either version 3 of the
   License, or (at your option) any later version.

   This program is distributed in the hope that it will be useful,
   but WITHOUT ANY WARRANTY; without even the implied warranty of
   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
   GNU Affero General Public License for more details.

   You should have received a copy of the GNU Affero General Public License
   along with this program.  If not, see <http://www.gnu.org/licenses/>. */
   
class snap4citytoken {
  static nodeAuthArray = [];
 
  // Metodi per leggere le variabili globali
  static getAuthArray() {
    return snap4citytoken.nodeAuthArray;
  }
  
  // Metodo per aggiornare le variabili globali
  static updateauthArray(value) {
    snap4citytoken.nodeAuthArray.push(value);
  }
  
  
  static accessTokenByAuthentication(array,authentication) {
	  for (let i = 0; i < array.length; i++) {
		if (array[i].authentication === authentication) {
		  return array[i].accessToken;
		}
	  }

	  return null;
	}
	
	// funzione per rimuovere gli elementi dell'array in base alla condizione specificata
	static removeExpiredElements() {
		var authArray = snap4citytoken.getAuthArray();
		if(authArray.length>0){
			const now = new Date(); // data corrente
			
			
			for (let i = 0; i < authArray.length; i++) {
				var advanceTime=20;
				if(authArray[i].expires_in>200){
					advanceTime=180;
				}
				const expirationTime = new Date(authArray[i].created.getTime() + authArray[i].expires_in * 1000-(advanceTime* 1000)); // data di scadenza
				if (expirationTime <= now) {
					authArray.splice(i, 1); // rimuovi l'elemento dall'array
					i--; // aggiorna l'indice del ciclo dopo la rimozione dell'elemento
				}
			}
		}
	}

	// funzione per eseguire removeExpiredElements ogni 10 secondi
    static startExpirationCheck() {
		setInterval(() => {
			snap4citytoken.removeExpiredElements();
		}, 10000); // eseguire la funzione ogni 30 secondi
	}
}

module.exports = snap4citytoken;