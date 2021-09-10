// Based on Numark Mixtrack Mapping Script Functions
//
// 1/11/2010 - v0.1 - Matteo <matteo@magm3.com>
//
// 5/18/2011 - Changed by James Ralston
//
// Known Bugs:
//  Mixxx complains about an undefined variable on 1st load of the mapping (ignore it, then restart Mixxx)
//  Each slide/knob needs to be moved on Mixxx startup to match levels with the Mixxx UI
//
// 05/26/2012 to 06/27/2012 - Changed by Darío José Freije <dario2004@gmail.com>

// 02/11/2017 - Modifications by Christie grinham <christiegrinham@gmail.com>
// 
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


/* CHRISTIE GRINHAM NEW FUNCTIONS

FX - Set lights on/off
Beat Roll Loop
Fix scratch keylock - set isKeyLocked to 1?

DONE:
Gains
Filters
Change FX1 to Keylock
Remove hotcue delete mode, replace with cue 4
Preview - If preview is playing, stop, otherwise load selected and play
SLIP MODE Switch - Keylock Button


Known Issues:
When scratch backwards through a loop, loop is disabled or keylock is disabled.

*/

function NumarkMixTrackProII() {}

NumarkMixTrackProII.init = function(id) {   // called when the MIDI device is opened & set up
    NumarkMixTrackProII.id = id;    // Store the ID of this device for later use

    // [deck 1, deck 2]
    NumarkMixTrackProII.directoryMode = false;
    NumarkMixTrackProII.scratch_mode = [false, false];
    NumarkMixTrackProII.manualLoop = [true, true];
    NumarkMixTrackProII.deleteKey = [false, false];
    NumarkMixTrackProII.isKeyLocked = [0, 0];
    NumarkMixTrackProII.touch = [false, false];
    NumarkMixTrackProII.scratchTimer = [-1, -1];

    NumarkMixTrackProII.shift_is_pressed = [false, false];
    NumarkMixTrackProII.pad_modes = {
        LOOP: 'loop',
        SAMPLE: 'sample',
        CUE: 'cue',
    }
    NumarkMixTrackProII.pad_mode = NumarkMixTrackProII.pad_modes.LOOP;
    NumarkMixTrackProII.delete_cue_mode = [false, false];
    NumarkMixTrackProII.cue_delete_mode = [false, false];
    NumarkMixTrackProII.loop_on = [false, false];
    NumarkMixTrackProII.pitch_slider_ranges = [0.08, 0.16, 0.50];
    NumarkMixTrackProII.pitch_slider_range_index = 0;

    // LED addresses
    NumarkMixTrackProII.leds = [
        // Common
        {"directory": 0x34,
         "file": 0x4B},
        // Deck 1
        {"rate": 0x28,
         "scratch_mode": 0x48,
         "loop_in": 0x53,
         "loop_out": 0x54,
         "reloop": 0x55,
         "loop_halve": 0x63,
         "sample_1": 0x65,
         "sample_2": 0x66,
         "sample_3": 0x67,
         "sample_4": 0x68,
         "hotcue_1" : 0x6D,
         "hotcue_2" : 0x6E,
         "hotcue_3" : 0x6F,
         "hotcue_4" : 0x70,
         "fx1": 0x59,
         "fx2": 0x5A,
         "fx3": 0x5B,
         "tap": 0x5C,
         "sync" : 0x40,
         "cue" : 0x33,
         "play_pause": 0x3B,
         "stutter" : 0x4A},
        // Deck 2
        {"rate": 0x29,
         "scratch_mode": 0x50,
         "loop_in": 0x56,
         "loop_out": 0x57,
         "reloop": 0x58,
         "loop_halve": 0x64,
         "sample_1": 0x69,
         "sample_2": 0x6A,
         "sample_3": 0x6B,
         "sample_4": 0x6C,
         "hotcue_1" : 0x71,
         "hotcue_2" : 0x72,
         "hotcue_3" : 0x73,
         "hotcue_4" : 0x74,
         "fx1": 0x5D,
         "fx2": 0x5E,
         "fx3": 0x5F,
         "tap": 0x60,
         "sync" : 0x47,
         "cue" : 0x3C,
         "play_pause": 0x42,
         "stutter" : 0x4C}
    ];

    NumarkMixTrackProII.led_timer_ids = {};

    // NumarkMixTrackProII.LedTimer = function(id, led, count, state){
    //     this.id = id;
    //     this.led = led;
    //     this.count = count;
    //     this.state = state;
    // }

    // Turn off all the leds
    for (var deck_index in NumarkMixTrackProII.leds) {
        for (var led in NumarkMixTrackProII.leds[deck_index]) {
            NumarkMixTrackProII.setLED(NumarkMixTrackProII.leds[deck_index][led], false);
        }
    }

    // for the flashing peak indicator
    NumarkMixTrackProII._flash_peak_state = [true, true];
    NumarkMixTrackProII._flash_peak_led_names = ["fx1", "fx2", "fx3", "tap"];

    // set up each deck
    for (var d = 1; d <= 2; d++) {
        // Turn on some pad leds
        var led_names = ["loop_in", "loop_out", "reloop", "loop_halve",
                         "sync", "cue", "stutter"];
        for (var i in led_names) {
            NumarkMixTrackProII.setLED(NumarkMixTrackProII.leds[d][led_names[i]], true);
        }
        // Enable soft-takeover for Pitch slider
        engine.softTakeover("[Channel"+d+"]", "rate", true);
        // beat leds
        engine.connectControl("[Channel"+d+"]",
                              "beat_active",
                              "NumarkMixTrackProII.flash_beat_leds");
        // indicators
        engine.connectControl("[Channel"+d+"]",
                              "PeakIndicator",
                              "NumarkMixTrackProII.flash_peak_indicator");
        engine.connectControl("[Channel"+d+"]",
                              "play_indicator",
                              "NumarkMixTrackProII.flash_play_button");
        engine.connectControl("[Channel"+d+"]",
                              "cue_indicator",
                              "NumarkMixTrackProII.flash_cue_button");
    }

    engine.setValue("[Master]", "volume", 0);
}

NumarkMixTrackProII.flash_play_button = function(value, group, control) {
    print("FLASHING PLAY BUTTON");
    var deck = NumarkMixTrackProII.groupToDeck(group);
    NumarkMixTrackProII.setLED(NumarkMixTrackProII.leds[deck]['play_pause'], value > 0);
}

NumarkMixTrackProII.flash_cue_button = function(value, group, control) {
    print("FLASHING CUE BUTTON");
    var deck = NumarkMixTrackProII.groupToDeck(group);
    NumarkMixTrackProII.setLED(NumarkMixTrackProII.leds[deck]['cue'], value > 0);
}


NumarkMixTrackProII.shutdown = function(id) {   // called when the MIDI device is closed
    NumarkMixTrackProII.turn_off_all_leds();
}

NumarkMixTrackProII.turn_off_all_leds = function() {
    // Turn off all the leds
    for (var deck_index in NumarkMixTrackProII.leds) {
        for (var led in NumarkMixTrackProII.leds[deck_index]) {
            NumarkMixTrackProII.setLED(NumarkMixTrackProII.leds[deck_index][led], false);
        }
    }
}


NumarkMixTrackProII.groupToDeck = function(group) {
    var matches = group.match(/^\[Channel(\d+)\]$/);
    if (matches == null) {
        return -1;
    } else {
        return matches[1];
    }
}


NumarkMixTrackProII.setLED = function(control, status) {
    midi.sendShortMsg(0x90, control, status ? 0x64 : 0x00);
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


NumarkMixTrackProII.cuebutton = function(channel, control, value, status, group) {
    var deck = NumarkMixTrackProII.groupToDeck(group);
    if (value && NumarkMixTrackProII.shift_is_pressed[deck-1]) {
        engine.setValue(group, "start", 1);
        engine.setValue(group, "cue_set", 1);
    }
    // Don't set Cue accidentaly at the end of the song
    // if (engine.getValue(group, "playposition") <= 0.97) {
        engine.setValue(group, "cue_default", value ? 1 : 0);
    // } else {
    //     engine.setValue(group, "cue_preview", value ? 1 : 0);
    // }
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



NumarkMixTrackProII.pitch = function(channel, control, value, status, group) {
    var deck = NumarkMixTrackProII.groupToDeck(group);
    // var rate = (value - 63.5) / 63.5;
    if (value < 64) {
        rate = (value - 64) / 64;
    } else {
        rate = (value - 64) / 63;
    }
    engine.setValue("[Channel"+deck+"]", "rate", rate);
    NumarkMixTrackProII.setLED(NumarkMixTrackProII.leds[deck]["rate"],
                               value == 64);
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

        if (NumarkMixTrackProII.scratch_mode[deck-1] && posNeg == -1 && !NumarkMixTrackProII.touch[deck-1]) {

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
        if (!NumarkMixTrackProII.scratch_mode[deck-1] && engine.getValue(group, "play")) return;

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


/* Load and Play Selected Track in Preview Deck or pause if playing */
NumarkMixTrackProII.preview_track = function(channel, control, value, status, group) {
    if (value > 0) {
        if (engine.getValue("[PreviewDeck1]", "play") == 1.0) {
            engine.setValue("[PreviewDeck1]", "stop", 1);
        } else {
            engine.setValue("[PreviewDeck1]", "LoadSelectedTrackAndPlay", true);
        }
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
    NumarkMixTrackProII.scratch_mode[deck-1] = !NumarkMixTrackProII.scratch_mode[deck-1];
    NumarkMixTrackProII.setLED(NumarkMixTrackProII.leds[deck]["scratch_mode"], NumarkMixTrackProII.scratch_mode[deck-1]);
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
    var deck = NumarkMixTrackProII.groupToDeck(group);
    NumarkMixTrackProII.shift_is_pressed[deck-1] = value == 0x7f ? true : false;
}


// OLD FUNCTION
/* if shift is held down: toggle keylock
 * else: temporarily bend the pitch down
 */
NumarkMixTrackProII.pitch_bend_down_or_keylock = function(channel, control, value, status, group) {
    var deck = NumarkMixTrackProII.groupToDeck(group);
    if (NumarkMixTrackProII.shift_is_pressed[deck-1]) {
        // toggle keylock (only on press down)
        if (value > 0) {
            var current_keylock_value = engine.getValue(group, 'keylock');
            engine.setValue(group, 'keylock', !current_keylock_value);
        }
    } else {
        // temp pitch down
        engine.setValue(group, 'rate_temp_down', value == 0 ? 0 : 1);
    }
}

// NEW FUNCTION
/* if shift is held down: toggle keylock
 * else: temporarily bend the pitch down
 */
NumarkMixTrackProII.pitch_bend_down_or_slip = function(channel, control, value, status, group) {
    var deck = NumarkMixTrackProII.groupToDeck(group);
    if (NumarkMixTrackProII.shift_is_pressed[deck-1]) {
        // toggle slip_enabled (only on press down)
        if (value > 0) {
            var current_slip_enabled_value = engine.getValue(group, 'slip_enabled');
            engine.setValue(group, 'slip_enabled', !current_slip_enabled_value);
        }
    } else {
        // temp pitch down
        engine.setValue(group, 'rate_temp_down', value == 0 ? 0 : 1);
    }
}

NumarkMixTrackProII.pitch_bend_up_or_range = function(channel, control, value, status, group) {
    var deck = NumarkMixTrackProII.groupToDeck(group);
    if (NumarkMixTrackProII.shift_is_pressed[deck-1]) {
        // cycle slider range
        if (value > 0) {
            var psri = NumarkMixTrackProII.pitch_slider_range_index;
            var psr = NumarkMixTrackProII.pitch_slider_ranges;
            NumarkMixTrackProII.pitch_slider_range_index = (psri + 1) % psr.length;
            print("setting rate to " + psr[psri]);
            engine.setValue(group, 'rateRange', psr[psri]);
        }
    } else {
        // temp pitch down
        engine.setValue(group, 'rate_temp_up', value > 0 ? 1 : 0);
    }
}


/* All hotcue buttons come here, enable/disable hotcues 1 to 3, toggle delete
 * with the fourth button.
 * LED comes on when there is a hotcue set for that pad.
 * It would be nice if they flashed when the delete button was turned on.
 */
NumarkMixTrackProII.hotcue = function(channel, control, value, status, group) {
    var deck = NumarkMixTrackProII.groupToDeck(group);
    var cue_midi_controls = [[0x6D, 0x6E, 0x6F, 0x70], [0x71, 0x72, 0x73, 0x74]];
    var cue_num = cue_midi_controls[deck-1].indexOf(control) + 1;
    if (value && NumarkMixTrackProII.cue_delete_mode[deck-1]) {
        // clear the cue and exit delete mode
        engine.setValue(group, 'hotcue_'+cue_num+'_clear', value);
        NumarkMixTrackProII.cue_delete_mode[deck-1] = false;
        NumarkMixTrackProII.setLED(NumarkMixTrackProII.leds[deck]["hotcue_4"], false);
    } else if (cue_num >= 1) {
        engine.setValue(group, 'hotcue_'+cue_num+'_activate', value);
    }
}


/* flashed the stutter led on every beat.
 * TODO: Cue flashes when near the end of the song
 */
NumarkMixTrackProII.flash_beat_leds = function (value, group, control) {
    // var secondsBlink = 30;
    // var secondsToEnd = engine.getValue("[Channel1]", "duration") * (1-engine.getValue("[Channel1]", "playposition"));

    // if (secondsToEnd < secondsBlink && secondsToEnd > 1 && engine.getValue("[Channel1]", "play")) { // The song is going to end

    //     NumarkMixTrackProII.setLED(NumarkMixTrackProII.leds[1]["cue"], value);
    // }

    var deck = NumarkMixTrackProII.groupToDeck(group);
    NumarkMixTrackProII.setLED(NumarkMixTrackProII.leds[deck]['stutter'], value);
    if (engine.getValue(group, 'loop_enabled') == "1") {
        // flash loop lights
        NumarkMixTrackProII.setLED(NumarkMixTrackProII.leds[deck]['loop_in'], value);
        NumarkMixTrackProII.setLED(NumarkMixTrackProII.leds[deck]['loop_out'], value);
    }
}


/* flashed the top row of lights when clipping */
NumarkMixTrackProII.flash_peak_indicator = function(value, group, control) {
    var deck = NumarkMixTrackProII.groupToDeck(group);
    if (value) {
        var timer_id = engine.beginTimer(
            100, "NumarkMixTrackProII._flash_peak_indicator_once_deck_" + deck);
        NumarkMixTrackProII.led_timer_ids['peak_indicator_'+deck] = timer_id;
    } else {
        engine.stopTimer(NumarkMixTrackProII.led_timer_ids['peak_indicator_'+deck]);
        print("stopped timer");
        // make sure the led's are back on
        NumarkMixTrackProII._flash_peak_state[deck] = false;
        var led_names =NumarkMixTrackProII._flash_peak_led_names;
        for (var i in led_names) {
            NumarkMixTrackProII.setLED(
                NumarkMixTrackProII.leds[deck][led_names[i]], false);
        }
    }
}

// can't send variables with timeouts
NumarkMixTrackProII._flash_peak_indicator_once_deck_1 = function() {
    NumarkMixTrackProII._flash_peak_indicator_once(1);
}

NumarkMixTrackProII._flash_peak_indicator_once_deck_2 = function() {
    NumarkMixTrackProII._flash_peak_indicator_once(2);
}

NumarkMixTrackProII._flash_peak_indicator_once = function(d) {
    // change state (off/on) and then display
    NumarkMixTrackProII._flash_peak_state[d] = !NumarkMixTrackProII._flash_peak_state[d];
    var led_names =NumarkMixTrackProII._flash_peak_led_names;
    for (var i in led_names) {
        NumarkMixTrackProII.setLED(
            NumarkMixTrackProII.leds[d][led_names[i]],
            NumarkMixTrackProII._flash_peak_state[d]);
    }
}

/* reloop exit causes loop_in and loop_out to flash in beat when loop is on */
NumarkMixTrackProII.reloop_exit = function(channel, control, value, status, group) {
    if (value) {
        var deck = NumarkMixTrackProII.groupToDeck(group);
        engine.setValue(group, 'reloop_exit', 1);
        // turn loop lights back on
        NumarkMixTrackProII.setLED(NumarkMixTrackProII.leds[deck]['loop_in'], true);
        NumarkMixTrackProII.setLED(NumarkMixTrackProII.leds[deck]['loop_out'], true);
    }
}


/* loop out sends the loop_out command, as you would expect, then tests
 * to see if the loop is enabled. If it is, then set the global variable
 * so that the led's can flash
 */
NumarkMixTrackProII.loop_out = function(channel, control, value, status, group) {
    if (value) {
        engine.setValue(group, 'loop_out', 1);
        var deck = NumarkMixTrackProII.groupToDeck(group);
        // turn loop lights off
        NumarkMixTrackProII.setLED(NumarkMixTrackProII.leds[deck]['loop_in'], false);
        NumarkMixTrackProII.setLED(NumarkMixTrackProII.leds[deck]['loop_out'], false);
    }
}


/* loop_halve unless shift_is_pressed, then double loop */
NumarkMixTrackProII.loop_halve = function(channel, control, value, status, group) {
    var deck = NumarkMixTrackProII.groupToDeck(group);
    if (value && NumarkMixTrackProII.shift_is_pressed[deck-1]) {
        engine.setValue(group, 'loop_double', 1);
    } else if (value) {
        engine.setValue(group, 'loop_halve', 1);
    }
}


/* if shift_is_pressed: fx else: auto-loop */
NumarkMixTrackProII.fx1_or_auto1 = function(channel, control, value, status, group) {
    var deck = NumarkMixTrackProII.groupToDeck(group);
    if (value && NumarkMixTrackProII.shift_is_pressed[deck-1]) {
        engine.setValue(group, 'beatloop', 1);
    } else if (value) {
        // Set Keylock
        // toggle keylock (only on press down)
        if (value > 0) {
            var current_keylock_value = engine.getValue(group, 'keylock');
            engine.setValue(group, 'keylock', !current_keylock_value);
        }
    }
}

NumarkMixTrackProII.fx2_or_auto2 = function(channel, control, value, status, group) {
    var deck = NumarkMixTrackProII.groupToDeck(group);
    if (value && NumarkMixTrackProII.shift_is_pressed[deck-1]) {
        engine.setValue(group, 'beatloop', 2);
    } else if (value) {
        var c = "filterHighKill";
        var kill = !engine.getValue(group, c);
        engine.setValue(group, c, kill);
        NumarkMixTrackProII.setLED(NumarkMixTrackProII.leds[deck]['fx2'], kill == "1");
    }
}

NumarkMixTrackProII.fx3_or_auto4 = function(channel, control, value, status, group) {
    var deck = NumarkMixTrackProII.groupToDeck(group);
    if (value && NumarkMixTrackProII.shift_is_pressed[deck-1]) {
        engine.setValue(group, 'beatloop', 4);
    } else if (value) {
        var c = "filterMidKill";
        var kill = !engine.getValue(group, c);
        engine.setValue(group, c, kill);
        NumarkMixTrackProII.setLED(NumarkMixTrackProII.leds[deck]['fx3'], kill == "1");
    }
}

NumarkMixTrackProII.tap_or_auto16 = function(channel, control, value, status, group) {
    var deck = NumarkMixTrackProII.groupToDeck(group);
    if (value && NumarkMixTrackProII.shift_is_pressed[deck-1]) {
        engine.setValue(group, 'beatloop', 16);
    } else if (value) {
        var c = "filterLowKill";
        var kill = !engine.getValue(group, c);
        engine.setValue(group, c, kill);
        NumarkMixTrackProII.setLED(NumarkMixTrackProII.leds[deck]['tap'], kill == "1");
    }
}


/* load selected track also turns on this channels pre-fader cue */
NumarkMixTrackProII.load_selected_track = function(channel, control, value, status, group) {
    if (value) {
        engine.setValue(group, "pfl", 1);
        engine.setValue(group, "LoadSelectedTrack", 1);
    }
}

/* Channel Filter */
NumarkMixTrackProII.track_filter = function(channel, control, value, status, group) {
    print (group)
    // Check the deck
    if (control == "0x1B") {
        deck = 1;
    } else if (control == "0x1E") {
        deck = 2;
    }

    var c = "QuickEffectRack";
    // Get current value
    var currentValue = engine.getParameter("[QuickEffectRack1_[Channel" + deck +"]]", "super1");
    var increment = 1 / 30;

    // Increase of decrease
    if (value == "0x01") {
        // increase value
        engine.setParameter("[QuickEffectRack1_[Channel" + deck +"]]", "super1", (currentValue + increment));
    } else if (value == "0x7F") {
        // decrease value
        engine.setParameter("[QuickEffectRack1_[Channel" + deck +"]]", "super1", (currentValue - increment));
    }
}

/* Channel Filter */
NumarkMixTrackProII.fx_super = function(channel, control, value, status, group) {
    print (group)

    if (control == 0x1C) {
        var g = "[EffectRack1_EffectUnit1]";
    } else {
        var g = "[EffectRack1_EffectUnit2]";
    }

    var c = "super1"
    // Get current value
    var currentValue = engine.getParameter(g, c);
    var increment = 1 / 30;

    // Increase of decrease
    if (value == "0x01") {
        // increase value
        engine.setParameter(g, c, (currentValue + increment));
    } else if (value == "0x7F") {
        // decrease value
        engine.setParameter(g, c, (currentValue - increment));
    }
}
