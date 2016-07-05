/**
 * Created by acastillo on 7/5/16.
 */
var request = require('request');
var OCLE = require('openchemlib-extended');

class Predictor1H{
    constructor(db){
        this.db =db;//File.loadJSON("../h1_database.json");
    }

    predictFromSpinus(molfile){
        request.post("http://www.nmrdb.org/service/predictor",{form:{molfile:molfile}},function(error, response, body){
            return body;
        });
    }

    predictFromAskErno(molfile, options){
        var currentDB = null;
        var options = options || {};
        if (options.db) {
            currentDB = options.db;
        }
        else {
            if(!this.db)
                currentDB =[[],[],[],[],[],[],[]];
        }
    }

}
    /**
     * @function nmrShiftDBPred1H(molfile)
     * This function predict shift for 1H-NMR, from a molfile by using the cheminfo reference data base.
     * @param    molfile:string    A molfile content
     * @returns    +Object an array of NMRSignal1D
     */
    function nmrShiftDBPred(molfile, options) {
        var currentDB = null;
        var options = options || {};
        if (options.db) {
            currentDB = options.db;
        }
        else {
            if(!this.db)
                this.db =[[],[],[],[],[],[],[]];
            currentDB = this.db;
        }

        options.debug = options.debug || false;
        var algorithm = options.algorithm || 0;
        var levels = options.hoseLevels || [6,5,4,3,2];
        var couplings = options.getCouplings || false;
        levels.sort(function(a, b) {
            return b - a;
        });

        var mol = molfile;
        if(typeof molfile==="string"){
            mol = OCLE.Molecule.fromMolfile(molfile);
            mol.addImplicitHydrogens();
        }
        var diaIDs = mol.getDiastereotopicAtomIDs("H");

        var infoCOSY = [];//mol.getCouplings();
        if(couplings){
        //    infoCOSY = mol.predictCouplings();
        }

        var atoms = {};
        var atomNumbers = [];
        var i, k, j, atom, hosesString;
        for (j = diaIDs.length-1; j >=0; j--) {
            hosesString = OCLE.Util.getHoseCodesFromDiastereotopicID(diaIDs[j].id,  {maxSphereSize:levels[0], type: algorithm});
            atom = {
                diaIDs: [diaIDs[j].id + ""]
            };
            for(k=0;k<levels.length;k++){
                atom["hose"+levels[k]] = hosesString[levels[k]-1]+"";
            }
            for (k = diaIDs[j].atoms.length - 1; k >= 0; k--) {
                atoms[diaIDs[j].atoms[k]] = JSON.parse(JSON.stringify(atom));
                atomNumbers.push(diaIDs[j].atoms[k]);
            }
        }
        //Now, we predict the chimical shift by using our copy of NMRShiftDB
        //var script2 = "select chemicalShift FROM assignment where ";//hose5='dgH`EBYReZYiIjjjjj@OzP`NET'";
        var toReturn = new Array(atomNumbers.length);
        for (j = 0; j < atomNumbers.length; j++) {
            atom = atoms[atomNumbers[j]];
            var res=null;
            k=0;
            //A really simple query
            while(res==null&&k<levels.length){
                res = currentDB[levels[k]][atom["hose"+levels[k]]];
                k++;
            }
            if (res == null) {
                res = {
                    cs: -9999999,
                    ncs: 0,
                    std: 0,
                    min: 0,
                    max: 0
                };
            }
            atom.level = levels[k-1];
            atom.delta = res.cs;
            atom.atomIDs = ["" + atomNumbers[j]];
            atom.ncs = res.ncs;
            atom.std = res.std;
            atom.min = res.min;
            atom.max = res.max;
            atom.j = [];

            //Add the predicted couplings
            //console.log(atomNumbers[j]+" "+infoCOSY[0].atom1);
            for (i = infoCOSY.length - 1; i >= 0; i--) {
                if (infoCOSY[i].atom1 - 1 == atomNumbers[j] && infoCOSY[i].coupling > 2) {
                    atom.j.push({
                        "assignmentTo": infoCOSY[i].atom2 - 1 + "",//Put the diaID instead
                        "coupling": infoCOSY[i].coupling,
                        "multiplicity": "d"
                    });
                }
            }

            toReturn[j]=atom;
        }

        if(options.ignoreLabile){
            var linksOH = mol.getPaths(1,1,"H","O",false);
            var linksNH = mol.getPaths(1,1,"H","N",false);
            //console.log(h1pred.length);
            for(j=toReturn.length-1;j>=0;j--){
                for(var k=0;k<linksOH.length;k++){
                    if(toReturn[j].diaIDs[0]==linksOH[k].diaID1){
                        toReturn.splice(j,1);
                        break;
                    }
                }
            }
            //console.log(h1pred.length);
            for(j=toReturn.length-1;j>=0;j--){
                for(var k=0;k<linksNH.length;k++){
                    if(toReturn[j].diaIDs[0]==linksNH[k].diaID1){
                        toReturn.splice(j,1);
                        break;
                    }
                }
            }
        }

        return toReturn;
    }

module.exports = nmrShiftDBPred;