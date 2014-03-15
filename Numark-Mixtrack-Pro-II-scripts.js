// Based on Numark Mixtrack Mapping Script Functions
// 1/11/2010 - v0.1 - Matteo <matteo@magm3.com>
//
// 5/18/2011 - Changed by James Ralston
//
// Known Bugs:
//  Mixxx complains about an undefined variable on 1st load of the mapping (ignore it, then restart Mixxx)
//  Each slide/knob needs to be moved on Mixxx startup to match levels with the Mixxx UI
//
// 05/26/2012 to 06/27/2012 - Changed by Darío José Freije <dario2004@gmail.com>
//
//  Almost all work like expected. Resume and Particularities:
//
// ************* Script now is Only for 1.11.0 and above *************
//
//  Delete + Effect: Brake Effect (maintain pressed).
//           Flanger Delay (2nd knob of effect section): Adjust the speed of Brake.
//
//  Delete + Hotcues: Clear Hotcues (First press Delete, then Hotcue).
//  Delete + Reloop:  Clear Loop.
//  Delete + Manual:  Set Quantize ON (for best manual loop) or OFF.
//  Delete + Sync:    Set Pitch to Zero.
//
//  Load track:     Only if the track is paused. Put the pitch in 0 at load.
//
//  Keylock: disabled on wheel touch when in scratch mode (make noise anyway at exit scratch).
//
//      Gain:   The 3rd knob of the "effect" section is "Gain" (up to clip).
//
//  Effect: Flanger. 1st and 2nd knob modify Depth and Delay.
//
//  Cue:    Don't set Cue accidentaly at the end of the song (return to the lastest cue).
//      LED ON when stopped. LED OFF when playing.
//      LED Blink at Beat time in the ultimates 30 seconds of song.
//
//  Stutter: Adjust BeatGrid in the correct place (usefull to sync well).
//       LED Blink at each Beat of the grid.
//
//  Sync:   If the other deck is stopped, only sync tempo (not fase).
//      LED Blink at Clip Gain (Peak indicator).
//
//  Pitch:  Up, Up; Down, Down. Pitch slide are inverted, to match with the screen (otherwise is very confusing).
//      Soft-takeover to prevent sudden wide parameter changes when the on-screen control diverges from a hardware control.
//      The control will have no effect until the position is close to that of the software,
//      at which point it will take over and operate as usual.
//
//  Auto Loop (LED ON):     Active at program Start.
//              "1 Bar" button: Active an Instant 4 beat Loop. Press again to exit loop.
//
//  Scratch:
//  In Stop mode, with Scratch OFF or ON:   Scratch at touch, and Stop moving when the wheel stop moving.
//  In Play mode, with Scratch OFF:     Only Pitch bend.
//  In Play mode, with Scratch ON:      Scratch at touch and, in Backwards Stop Scratch when the wheel stop moving for 20ms -> BACKSPIN EFFECT!!!!.
//                      In Fordward Stop Scratch when the touch is released > Play Inmediatly (without breaks for well mix).
//                      Border of the wheels: Pitch Bend.
//


function NumarkMixTrackProII() {}

NumarkMixTrackProII.init = function(id) {   // called when the MIDI device is opened & set up
    NumarkMixTrackProII.id = id;    // Store the ID of this device for later use

    NumarkMixTrackProII.directoryMode = false;
    NumarkMixTrackProII.scratchMode = [false, false];
    NumarkMixTrackProII.manualLoop = [true, true];
    NumarkMixTrackProII.deleteKey = [false, false];
    NumarkMixTrackProII.isKeyLocked = [0, 0];
    NumarkMixTrackProII.touch = [false, false];
    NumarkMixTrackProII.scratchTimer = [-1, -1];
    NumarkMixTrackProII.shift_is_pressed = [false, false];  // deck 1, deck 2

    NumarkMixTrackProII.leds = [
        // Common
        { "directory": 0x34, "file": 0x4B },
        // Deck 1
        { "rate": 0x28, "scratchMode": 0x48, "manualLoop": 0x61,
        "loop_start_position": 0x53, "loop_end_position": 0x54, "reloop_exit": 0x55,
        "deleteKey" : 0x59, "hotCue1" : 0x5a,"hotCue2" : 0x5b,"hotCue3" :  0x5c,
        "stutter" : 0x4a, "Cue" : 0x33, "sync" : 0x40
        },
        // Deck 2
        { "rate": 0x29, "scratchMode": 0x50, "manualLoop": 0x62,
        "loop_start_position": 0x56, "loop_end_position": 0x57, "reloop_exit": 0x58,
        "deleteKey" : 0x5d, "hotCue1" : 0x5e, "hotCue2" : 0x5f, "hotCue3" :  0x60,
        "stutter" : 0x4c, "Cue" : 0x3c, "sync" : 0x47
         }
    ];

    NumarkMixTrackProII.ledTimers = {};

    NumarkMixTrackProII.LedTimer = function(id, led, count, state){
        this.id = id;
        this.led = led;
        this.count = count;
        this.state = state;
    }

    for (i=0x30; i<=0x73; i++) midi.sendShortMsg(0x90, i, 0x00);    // Turn off all the lights

    NumarkMixTrackProII.hotCue = {
            //Deck 1
            0x5a:"1", 0x5b:"2", 0x5c:"3",
            //Deck 2
            0x5e: "1", 0x5f:"2", 0x60:"3"
            };

    //Add event listeners
    for (var i=1; i<3; i++){
        for (var x=1; x<4; x++){
            engine.connectControl("[Channel" + i +"]", "hotcue_"+ x +"_enabled", "NumarkMixTrackProII.onHotCueChange");
        }
        NumarkMixTrackProII.setLoopMode(i, false);
    }

    NumarkMixTrackProII.setLED(NumarkMixTrackProII.leds[0]["file"], true);


// Enable soft-takeover for Pitch slider

    engine.softTakeover("[Channel1]", "rate", true);
    engine.softTakeover("[Channel2]", "rate", true);


// Clipping LED
    engine.connectControl("[Channel1]","PeakIndicator","NumarkMixTrackProII.Channel1Clip");
    engine.connectControl("[Channel2]","PeakIndicator","NumarkMixTrackProII.Channel2Clip");

// Stutter beat light
    engine.connectControl("[Channel1]","beat_active","NumarkMixTrackProII.Stutter1Beat");
    engine.connectControl("[Channel2]","beat_active","NumarkMixTrackProII.Stutter2Beat");


}


NumarkMixTrackProII.Channel1Clip = function (value) {
    NumarkMixTrackProII.clipLED(value,NumarkMixTrackProII.leds[1]["sync"]);

}

NumarkMixTrackProII.Channel2Clip = function (value) {
    NumarkMixTrackProII.clipLED(value,NumarkMixTrackProII.leds[2]["sync"]);

}

NumarkMixTrackProII.Stutter1Beat = function (value) {

    var secondsBlink = 30;
        var secondsToEnd = engine.getValue("[Channel1]", "duration") * (1-engine.getValue("[Channel1]", "playposition"));

    if (secondsToEnd < secondsBlink && secondsToEnd > 1 && engine.getValue("[Channel1]", "play")) { // The song is going to end

        NumarkMixTrackProII.setLED(NumarkMixTrackProII.leds[1]["Cue"], value);
    }
    NumarkMixTrackProII.setLED(NumarkMixTrackProII.leds[1]["stutter"], value);

}

NumarkMixTrackProII.Stutter2Beat = function (value) {

    var secondsBlink = 30;
        var secondsToEnd = engine.getValue("[Channel2]", "duration") * (1-engine.getValue("[Channel2]", "playposition"));

    if (secondsToEnd < secondsBlink && secondsToEnd > 1 && engine.getValue("[Channel2]", "play")) { // The song is going to end

        NumarkMixTrackProII.setLED(NumarkMixTrackProII.leds[2]["Cue"], value);
    }

    NumarkMixTrackProII.setLED(NumarkMixTrackProII.leds[2]["stutter"], value);

}

NumarkMixTrackProII.clipLED = function (value, note) {

    if (value>0) NumarkMixTrackProII.flashLED(note, 1);

}

NumarkMixTrackProII.shutdown = function(id) {   // called when the MIDI device is closed

    // First Remove event listeners
    for (var i=1; i<2; i++){
        for (var x=1; x<4; x++){
            engine.connectControl("[Channel" + i +"]", "hotcue_"+ x +"_enabled", "NumarkMixTrackProII.onHotCueChange", true);
        }
        NumarkMixTrackProII.setLoopMode(i, false);
    }

    var lowestLED = 0x30;
    var highestLED = 0x73;
    for (var i=lowestLED; i<=highestLED; i++) {
        NumarkMixTrackProII.setLED(i, false);   // Turn off all the lights
    }

}

NumarkMixTrackProII.samplesPerBeat = function(group) {
    // FIXME: Get correct samplerate and channels for current deck
    var sampleRate = 44100;
    var channels = 2;
    var bpm = engine.getValue(group, "file_bpm");
    return channels * sampleRate * 60 / bpm;
}

NumarkMixTrackProII.groupToDeck = function(group) {

    var matches = group.match(/^\[Channel(\d+)\]$/);

    if (matches == null) {
        return -1;
    } else {
        return matches[1];
    }

}

NumarkMixTrackProII.setLED = function(value, status) {

    status = status ? 0x64 : 0x00;
    midi.sendShortMsg(0x90, value, status);
}

NumarkMixTrackProII.flashLED = function (led, veces){
    var ndx = Math.random();
    var func = "NumarkMixTrackProII.doFlash(" + ndx + ", " + veces + ")";
    var id = engine.beginTimer(120, func);
    NumarkMixTrackProII.ledTimers[ndx] =  new NumarkMixTrackProII.LedTimer(id, led, 0, false);
}

NumarkMixTrackProII.doFlash = function(ndx, veces){
    var ledTimer = NumarkMixTrackProII.ledTimers[ndx];

    if (!ledTimer) return;

    if (ledTimer.count > veces){ // how many times blink the button
        engine.stopTimer(ledTimer.id);
        delete NumarkMixTrackProII.ledTimers[ndx];
    } else{
        ledTimer.count++;
        ledTimer.state = !ledTimer.state;
        NumarkMixTrackProII.setLED(ledTimer.led, ledTimer.state);
    }
}

NumarkMixTrackProII.selectKnob = function(channel, control, value, status, group) {
    if (value > 63) {
        value = value - 128;
    }
    if (NumarkMixTrackProII.directoryMode) {
        if (value > 0) {
            for (var i = 0; i < value; i++) {
                engine.setValue(group, "SelectNextPlaylist", 1);
            }
        } else {
            for (var i = 0; i < -value; i++) {
                engine.setValue(group, "SelectPrevPlaylist", 1);
            }
        }
    } else {
        engine.setValue(group, "SelectTrackKnob", value);

    }
}

NumarkMixTrackProII.LoadTrack = function(channel, control, value, status, group) {

    // Load the selected track in the corresponding deck only if the track is paused

    if(value && engine.getValue(group, "play") != 1)
    {
        engine.setValue(group, "LoadSelectedTrack", 1);

        // cargar el tema con el pitch en 0
        engine.softTakeover(group, "rate", false);
        engine.setValue(group, "rate", 0);
        engine.softTakeover(group, "rate", true);
    }
    else engine.setValue(group, "LoadSelectedTrack", 0);

}

NumarkMixTrackProII.flanger = function(channel, control, value, status, group) {

//  if (!value) return;

    var deck = NumarkMixTrackProII.groupToDeck(group);

    var speed = 1;

    if(NumarkMixTrackProII.deleteKey[deck-1]){

    // Delete + Effect = Brake

//  print ("Delay: " + engine.getValue("[Flanger]","lfoDelay"));

        if (engine.getValue("[Flanger]","lfoDelay") < 5026) {

            speed = engine.getValue("[Flanger]","lfoDelay") / 5025;

            if (speed < 0) speed = 0;

        } else {

            speed = (engine.getValue("[Flanger]","lfoDelay") - 5009)/ 16,586666667

            if (speed > 300) speed = 300;
        }

//  print ("Speed: " + speed);

        engine.brake(deck, value, speed);

        if (!value) NumarkMixTrackProII.toggleDeleteKey(channel, control, 1, status, group);

    } else {
        if (!value) return;
        if (engine.getValue(group, "flanger")) {
            engine.setValue(group, "flanger", 0);
        }else{
            engine.setValue(group, "flanger", 1);
        }
    }

}


NumarkMixTrackProII.cuebutton = function(channel, control, value, status, group) {


    // Don't set Cue accidentaly at the end of the song
    if (engine.getValue(group, "playposition") <= 0.97) {
            engine.setValue(group, "cue_default", value ? 1 : 0);
    } else {
        engine.setValue(group, "cue_preview", value ? 1 : 0);
    }

}

NumarkMixTrackProII.beatsync = function(channel, control, value, status, group) {

    var deck = NumarkMixTrackProII.groupToDeck(group);

    if(NumarkMixTrackProII.deleteKey[deck-1]){

        // Delete + SYNC = vuelve pitch a 0
        engine.softTakeover(group, "rate", false);
        engine.setValue(group, "rate", 0);
        engine.softTakeover(group, "rate", true);

        NumarkMixTrackProII.toggleDeleteKey(channel, control, value, status, group);

    } else {

            if (deck == 1) {
                // si la otra deck esta en stop, sincronizo sólo el tempo (no el golpe)
                if(!engine.getValue("[Channel2]", "play")) {
                    engine.setValue(group, "beatsync_tempo", value ? 1 : 0);
                } else {
                        engine.setValue(group, "beatsync", value ? 1 : 0);
                    }
            }

            if (deck == 2) {
                // si la otra deck esta en stop, sincronizo sólo el tempo (no el golpe)
                if(!engine.getValue("[Channel1]", "play")) {
                    engine.setValue(group, "beatsync_tempo", value ? 1 : 0);
                } else {
                        engine.setValue(group, "beatsync", value ? 1 : 0);
                    }
            }
        }
}


NumarkMixTrackProII.playbutton = function(channel, control, value, status, group) {

    if (!value) return;

    var deck = NumarkMixTrackProII.groupToDeck(group);

    if (engine.getValue(group, "play")) {
        engine.setValue(group, "play", 0);
    }else{
        engine.setValue(group, "play", 1);
    }

}


NumarkMixTrackProII.loopIn = function(channel, control, value, status, group) {
    var deck = NumarkMixTrackProII.groupToDeck(group);

    if (NumarkMixTrackProII.manualLoop[deck-1]){
        if (!value) return;
        // Act like the Mixxx UI
        engine.setValue(group, "loop_in", status?1:0);
        return;
    }

    // Auto Loop: 1/2 loop size
    var start = engine.getValue(group, "loop_start_position");
    var end = engine.getValue(group, "loop_end_position");
    if (start<0 || end<0) {
        NumarkMixTrackProII.flashLED(NumarkMixTrackProII.leds[deck]["loop_start_position"], 4);
        return;
    }

    if (value){
        var start = engine.getValue(group, "loop_start_position");
        var end = engine.getValue(group, "loop_end_position");
        var len = (end - start) / 2;
        engine.setValue(group, "loop_end_position", start + len);
        NumarkMixTrackProII.setLED(NumarkMixTrackProII.leds[deck]["loop_start_position"], true);
    } else {
        NumarkMixTrackProII.setLED(NumarkMixTrackProII.leds[deck]["loop_start_position"], false);
    }
}

NumarkMixTrackProII.loopOut = function(channel, control, value, status, group) {
    var deck = NumarkMixTrackProII.groupToDeck(group);

    if (!value) return;

    if (NumarkMixTrackProII.manualLoop[deck-1]){
        // Act like the Mixxx UI
        engine.setValue(group, "loop_out", status?1:0);
        return;
    }

    var isLoopActive = engine.getValue(group, "loop_enabled");

    // Set a 4 beat auto loop or exit the loop

    if(!isLoopActive){
        engine.setValue(group,"beatloop_4",1);
    }else{
        engine.setValue(group,"beatloop_4",0);
    }

}

NumarkMixTrackProII.repositionHack = function(group, oldPosition){
    // see if the value has been updated
    if (engine.getValue(group, "loop_start_position")==oldPosition){
        if (NumarkMixTrackProII.hackCount[group]++ < 9){
            engine.beginTimer(20, "NumarkMixTrackProII.repositionHack('" + group + "', " + oldPosition + ")", true);
        } else {
            var deck = NumarkMixTrackProII.groupToDeck(group);
            NumarkMixTrackProII.flashLED(NumarkMixTrackProII.leds[deck]["loop_start_position"], 4);
        }
        return;
    }
    var bar = NumarkMixTrackProII.samplesPerBeat(group);
    var start = engine.getValue(group, "loop_start_position");
    engine.setValue(group,"loop_end_position", start + bar);
}

NumarkMixTrackProII.reLoop = function(channel, control, value, status, group) {
    var deck = NumarkMixTrackProII.groupToDeck(group);

    if (NumarkMixTrackProII.manualLoop[deck-1]){
        // Act like the Mixxx UI (except for working delete)
        if (!value) return;
        if (NumarkMixTrackProII.deleteKey[deck-1]){
            engine.setValue(group, "reloop_exit", 0);
            engine.setValue(group, "loop_start_position", -1);
            engine.setValue(group, "loop_end_position", -1);
            NumarkMixTrackProII.toggleDeleteKey(channel, control, value, status, group);
        } else {
            engine.setValue(group, "reloop_exit", status?1:0);
        }
        return;
    }

    // Auto Loop: Double Loop Size
    var start = engine.getValue(group, "loop_start_position");
    var end = engine.getValue(group, "loop_end_position");
    if (start<0 || end<0) {
        NumarkMixTrackProII.flashLED(NumarkMixTrackProII.leds[deck]["reloop_exit"], 4);
        return;
    }

    if (value){
        var len = (end - start) * 2;
        engine.setValue(group, "loop_end_position", start + len);
        NumarkMixTrackProII.setLED(NumarkMixTrackProII.leds[deck]["reloop_exit"], true);
    } else {
        NumarkMixTrackProII.setLED(NumarkMixTrackProII.leds[deck]["reloop_exit"], false);
    }
}

NumarkMixTrackProII.setLoopMode = function(deck, manual) {

    NumarkMixTrackProII.manualLoop[deck-1] = manual;
    NumarkMixTrackProII.setLED(NumarkMixTrackProII.leds[deck]["manualLoop"], !manual);
    engine.connectControl("[Channel" + deck + "]", "loop_start_position", "NumarkMixTrackProII.onLoopChange", !manual);
    engine.connectControl("[Channel" + deck + "]", "loop_end_position", "NumarkMixTrackProII.onLoopChange", !manual);
    engine.connectControl("[Channel" + deck + "]", "loop_enabled", "NumarkMixTrackProII.onReloopExitChange", !manual);
    engine.connectControl("[Channel" + deck + "]", "loop_enabled", "NumarkMixTrackProII.onReloopExitChangeAuto", manual);

    var group = "[Channel" + deck + "]"
    if (manual){
        NumarkMixTrackProII.setLED(NumarkMixTrackProII.leds[deck]["loop_start_position"], engine.getValue(group, "loop_start_position")>-1);
        NumarkMixTrackProII.setLED(NumarkMixTrackProII.leds[deck]["loop_end_position"], engine.getValue(group, "loop_end_position")>-1);
        NumarkMixTrackProII.setLED(NumarkMixTrackProII.leds[deck]["reloop_exit"], engine.getValue(group, "loop_enabled"));
    }else{
        NumarkMixTrackProII.setLED(NumarkMixTrackProII.leds[deck]["loop_start_position"], false);
        NumarkMixTrackProII.setLED(NumarkMixTrackProII.leds[deck]["loop_end_position"], engine.getValue(group, "loop_enabled"));
        NumarkMixTrackProII.setLED(NumarkMixTrackProII.leds[deck]["reloop_exit"], false);
    }
}

NumarkMixTrackProII.toggleManualLooping = function(channel, control, value, status, group) {
    if (!value) return;

    var deck = NumarkMixTrackProII.groupToDeck(group);

    if(NumarkMixTrackProII.deleteKey[deck-1]){
        // activar o desactivar quantize

        if (engine.getValue(group, "quantize")) {
            engine.setValue(group, "quantize", 0);
        }else{
            engine.setValue(group, "quantize", 1);
        }

        NumarkMixTrackProII.toggleDeleteKey(channel, control, value, status, group);
    } else {

        NumarkMixTrackProII.setLoopMode(deck, !NumarkMixTrackProII.manualLoop[deck-1]);
    }
}

NumarkMixTrackProII.onLoopChange = function(value, group, key){
    var deck = NumarkMixTrackProII.groupToDeck(group);
    NumarkMixTrackProII.setLED(NumarkMixTrackProII.leds[deck][key], value>-1? true : false);
}

NumarkMixTrackProII.onReloopExitChange = function(value, group, key){
    var deck = NumarkMixTrackProII.groupToDeck(group);
    NumarkMixTrackProII.setLED(NumarkMixTrackProII.leds[deck]['reloop_exit'], value);
}

NumarkMixTrackProII.onReloopExitChangeAuto = function(value, group, key){
    var deck = NumarkMixTrackProII.groupToDeck(group);
    NumarkMixTrackProII.setLED(NumarkMixTrackProII.leds[deck]['loop_end_position'], value);
}

// Stutters adjust BeatGrid
NumarkMixTrackProII.playFromCue = function(channel, control, value, status, group) {

    var deck = NumarkMixTrackProII.groupToDeck(group);

    if (engine.getValue(group, "beats_translate_curpos")){

        engine.setValue(group, "beats_translate_curpos", 0);
        NumarkMixTrackProII.setLED(NumarkMixTrackProII.leds[deck]["stutter"], 0);
    }else{
        engine.setValue(group, "beats_translate_curpos", 1);
        NumarkMixTrackProII.setLED(NumarkMixTrackProII.leds[deck]["stutter"], 1);
    }

}

NumarkMixTrackProII.pitch = function(channel, control, value, status, group) {
    var deck = NumarkMixTrackProII.groupToDeck(group);

    var pitch_value = 0;

    if (value < 64) pitch_value = (value-64) /64;
    if (value > 64) pitch_value = (value-64) /63;

    engine.setValue("[Channel"+deck+"]","rate",pitch_value);

    if (value == 64)
    {
      NumarkMixTrackProII.setLED(NumarkMixTrackProII.leds[deck]["rate"], 1);
    }
    else
    {
      NumarkMixTrackProII.setLED(NumarkMixTrackProII.leds[deck]["rate"], 0);
    }
}


NumarkMixTrackProII.jogWheel = function(channel, control, value, status, group) {
    var deck = NumarkMixTrackProII.groupToDeck(group);

//  if (!NumarkMixTrackProII.touch[deck-1] && !engine.getValue(group, "play")) return;

    var adjustedJog = parseFloat(value);
    var posNeg = 1;
    if (adjustedJog > 63) { // Counter-clockwise
        posNeg = -1;
        adjustedJog = value - 128;
    }

    if (engine.getValue(group, "play")) {

        if (NumarkMixTrackProII.scratchMode[deck-1] && posNeg == -1 && !NumarkMixTrackProII.touch[deck-1]) {

            if (NumarkMixTrackProII.scratchTimer[deck-1] != -1) engine.stopTimer(NumarkMixTrackProII.scratchTimer[deck-1]);
            NumarkMixTrackProII.scratchTimer[deck-1] = engine.beginTimer(20, "NumarkMixTrackProII.jogWheelStopScratch(" + deck + ")", true);
        }

    } else { // en stop hace scratch siempre

        if (!NumarkMixTrackProII.touch[deck-1]){

            if (NumarkMixTrackProII.scratchTimer[deck-1] != -1) engine.stopTimer(NumarkMixTrackProII.scratchTimer[deck-1]);
            NumarkMixTrackProII.scratchTimer[deck-1] = engine.beginTimer(20, "NumarkMixTrackProII.jogWheelStopScratch(" + deck + ")", true);
        }

    }

    engine.scratchTick(deck, adjustedJog);

    if (engine.getValue(group,"play")) {
        var gammaInputRange = 13;   // Max jog speed
        var maxOutFraction = 0.8;   // Where on the curve it should peak; 0.5 is half-way
        var sensitivity = 0.5;      // Adjustment gamma
        var gammaOutputRange = 2;   // Max rate change

        adjustedJog = posNeg * gammaOutputRange * Math.pow(Math.abs(adjustedJog) / (gammaInputRange * maxOutFraction), sensitivity);
        engine.setValue(group, "jog", adjustedJog);
    }

}


NumarkMixTrackProII.jogWheelStopScratch = function(deck) {
    NumarkMixTrackProII.scratchTimer[deck-1] = -1;
    engine.scratchDisable(deck);

        if (NumarkMixTrackProII.isKeyLocked[deck-1] == 1) {
            // print ("restaurando keylock");
            // Restore the previous state of the Keylock
            engine.setValue("[Channel"+deck+"]", "keylock", NumarkMixTrackProII.isKeyLocked[deck-1]);
            NumarkMixTrackProII.isKeyLocked[deck-1] = 0;
        }

}

NumarkMixTrackProII.wheelTouch = function(channel, control, value, status, group){

    var deck = NumarkMixTrackProII.groupToDeck(group);

    if(!value){

        NumarkMixTrackProII.touch[deck-1]= false;

//  paro el timer (si no existe da error mmmm) y arranco un nuevo timer.
//  Si en 20 milisegundos no se mueve el plato, desactiva el scratch

        if (NumarkMixTrackProII.scratchTimer[deck-1] != -1) engine.stopTimer(NumarkMixTrackProII.scratchTimer[deck-1]);

        NumarkMixTrackProII.scratchTimer[deck-1] = engine.beginTimer(20, "NumarkMixTrackProII.jogWheelStopScratch(" + deck + ")", true);

    } else {

        // si esta en play y el modo scratch desactivado, al presionar el touch no hace nada
        if (!NumarkMixTrackProII.scratchMode[deck-1] && engine.getValue(group, "play")) return;

        // Save the current state of the keylock
        NumarkMixTrackProII.isKeyLocked[deck-1] = engine.getValue(group, "keylock");
        // Turn the Keylock off for scratching
        if (NumarkMixTrackProII.isKeyLocked[deck-1]){
            engine.setValue(group, "keylock", 0);
        }


        if (NumarkMixTrackProII.scratchTimer[deck-1] != -1) engine.stopTimer(NumarkMixTrackProII.scratchTimer[deck-1]);

        // change the 600 value for sensibility
        engine.scratchEnable(deck, 600, 33+1/3, 1.0/8, (1.0/8)/32);

        NumarkMixTrackProII.touch[deck-1]= true;
    }
}

NumarkMixTrackProII.toggleDirectoryMode = function(channel, control, value, status, group) {
    // Toggle setting and light
    if (value) {
        NumarkMixTrackProII.directoryMode = !NumarkMixTrackProII.directoryMode;

        NumarkMixTrackProII.setLED(NumarkMixTrackProII.leds[0]["directory"], NumarkMixTrackProII.directoryMode);
        NumarkMixTrackProII.setLED(NumarkMixTrackProII.leds[0]["file"], !NumarkMixTrackProII.directoryMode);
    }
}

NumarkMixTrackProII.toggleScratchMode = function(channel, control, value, status, group) {
    if (!value) return;

    var deck = NumarkMixTrackProII.groupToDeck(group);
    // Toggle setting and light
    NumarkMixTrackProII.scratchMode[deck-1] = !NumarkMixTrackProII.scratchMode[deck-1];
    NumarkMixTrackProII.setLED(NumarkMixTrackProII.leds[deck]["scratchMode"], NumarkMixTrackProII.scratchMode[deck-1]);
}


NumarkMixTrackProII.onHotCueChange = function(value, group, key){
    var deck = NumarkMixTrackProII.groupToDeck(group);
    var hotCueNum = key[7];
    NumarkMixTrackProII.setLED(NumarkMixTrackProII.leds[deck]["hotCue" + hotCueNum], value ? true : false);
}

NumarkMixTrackProII.changeHotCue = function(channel, control, value, status, group){

    var deck = NumarkMixTrackProII.groupToDeck(group);
    var hotCue = NumarkMixTrackProII.hotCue[control];

    // onHotCueChange called automatically
    if(NumarkMixTrackProII.deleteKey[deck-1]){
        if (engine.getValue(group, "hotcue_" + hotCue + "_enabled")){
            engine.setValue(group, "hotcue_" + hotCue + "_clear", 1);
        }
        NumarkMixTrackProII.toggleDeleteKey(channel, control, value, status, group);
    } else {
        if (value) {
            engine.setValue(group, "hotcue_" + hotCue + "_activate", 1);

        }else{

            engine.setValue(group, "hotcue_" + hotCue + "_activate", 0);
        }
    }
}


NumarkMixTrackProII.toggleDeleteKey = function(channel, control, value, status, group){
    if (!value) return;

    var deck = NumarkMixTrackProII.groupToDeck(group);
    NumarkMixTrackProII.deleteKey[deck-1] = !NumarkMixTrackProII.deleteKey[deck-1];
    NumarkMixTrackProII.setLED(NumarkMixTrackProII.leds[deck]["deleteKey"], NumarkMixTrackProII.deleteKey[deck-1]);
}


/* Shift key pressed/unpressed - toggle shift status in controller object
 * so that other buttons can detect if shift button is currently held down
 */
NumarkMixTrackProII.shift = function(channel, control, value, status, group) {
    var channel_index = group == "[Channel1]" ? 0 : 1;
    NumarkMixTrackProII.shift_is_pressed[channel_index] = value == 0x7f ? true : false;
    print("Shift status: " + NumarkMixTrackProII.shift_is_pressed);
}

/* if shift is held down: toggle keylock
 * else: temporarily bend the pitch down
 */
NumarkMixTrackProII.pitch_bend_down_or_keylock = function(channel, control, value, status, group) {
    print("PITCH_BEND_DOWN_OR_KEYLOCK");
    var channel_index = group == "[Channel1]" ? 0 : 1;
    print("channel index " + channel_index);
    print("shift is " + NumarkMixTrackProII.shift_is_pressed[channel_index]);
    if (NumarkMixTrackProII.shift_is_pressed[channel_index]) {
        // toggle keylock (only on press down)
        if (value > 0) {
            var current_keylock_value = engine.getValue(group, 'keylock');
            engine.setValue(group, 'keylock', 1 ^ current_keylock_value);
        }
    } else {
        // temp pitch down
        engine.setValue(group, 'rate_temp_down', value == 0 ? 0 : 1);
    }
}
