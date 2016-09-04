/**
 * Created by acastillo on 7/5/16.
 */
const SpinSystem = require('./SpinSystem');
const AutoAssigner = require('./AutoAssigner');

function autoAssign(entry, options) {
    if(entry.spectra.h1PeakList){
        return assignmentFromPeakPicking(entry, options);
    }
    else{
        return assignmentFromRaw(entry, options);
    }
}

function assignmentFromRaw(entry, options) {
    var molfile = entry.molfile;
    var spectra = entry.spectra;

    var molecule=ACT.load(molfile);

    molecule.expandHydrogens();

    entry.molecule = molecule;
    entry.diaIDs = molecule.getDiastereotopicAtomIDs();

    //Simulate and process the 1H-NMR spectrum at 400MHz
    var jcampFile = molFiles[i].replace("mol_","h1_").replace(".mol",".jdx");
    var spectraData1H = SD.load(spectra.h1);//


    var signals = spectraData1H.nmrPeakDetection({nStddev:3, baselineRejoin:5, compute:false});
    spectra.solvent = spectraData1H.getParamString(".SOLVENT NAME", "unknown");
    entry.diaID = molecule.toIDCode();

    signals = integration(signals, molecule.countAtom("H"));

    for(var j=0;j< signals.length;j++){
        signals[j]._highlight=[-(j+1)];
    }

    spectra.h1PeakList = signals;

    return assignmentFromPeakPicking(entry,options);
}

function assignmentFromPeakPicking(entry, options) {
    const predictor = options.predictor;
    var molecule, diaIDs, molfile;

    var spectra = entry.spectra;
    if(!entry.molecule) {
        molecule=ACT.load(entry.molfile);
        molecule.expandHydrogens();
        diaIDs=molecule.getDiastereotopicAtomIDs();

        for (var j = 0; j < diaIDs.length; j++) {
            diaIDs[j].nbEquivalent=diaIDs[j].atoms.length;
        }

        diaIDs.sort(function(a,b) {
            if (a.element == b.element) {
                return b.nbEquivalent-a.nbEquivalent;
            }
            return a.element<b.element?1:-1;
        });
        entry.molecule = molecule;
        entry.diaIDs = diaIDs;
        entry.diaID = molecule.toIDCode();
    }
    else {
        molecule = entry.molecule;
        diaIDs = entry.diaIDs;
    }

    //H1 prediction
    var h1pred = predictor.predict(molecule, {group:true});
    if(!h1pred || h1pred.length === 0)
        return null;

    var optionsError = {iteration:options.iteration || 1, learningRatio:options.learningRatio || 1};

    for (var j=0; j<h1pred.length; j++) {
        h1pred[j].error = getError(h1pred[j], optionsError);
    }

    h1pred.sort(function(a,b) {
        if (a.atomLabel==b.atomLabel) {
            return b.integral-a.integral;
        }
        return a.atomLabel<b.atomLabel?1:-1;
    });

    try{
        const spinSystem = new SpinSystem(h1pred, spectra.h1PeakList);
        const autoAssigner = new AutoAssigner(spinSystem, options);
        return autoAssigner.getAssignments();
    }
    catch(e){
        console.log("Could not assign this molecule.");
        return null;
    }
}

function  getError(prediction, param){
    //console.log(prediction)
    //Never use predictions with less than 3 votes
    if(prediction.std==0||prediction.ncs<3){
        return 20;
    }
    else{
        //factor is between 1 and +inf
        //console.log(prediction.ncs+" "+(param.iteration+1)+" "+param.learningRatio);
        var factor = 3*prediction.std/
            (Math.pow(prediction.ncs,(param.iteration+1)*param.learningRatio));//(param.iteration+1)*param.learningRatio*h1pred[indexSignal].ncs;
        return 3*prediction.std+factor;
    }
    return 20;
}

module.exports = autoAssign;
