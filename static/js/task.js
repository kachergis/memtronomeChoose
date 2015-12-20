/*
 * Requires:
 *     psiturk.js
 *     utils.js
 */

// Initalize psiturk object
var psiTurk = PsiTurk(uniqueId, adServerLoc);

var mycondition = condition;  // these two variables are passed by the psiturk server process
var mycounterbalance = counterbalance;  // they tell you which condition you have been assigned to

var condition_name = "";
// orig ISI_LEVELS = [500,2000,4000];
//var ISI_LEVELS = [100,1000,2000,3000,6000,9000,12000]; // use each ISI for num_items_studied/4 items
var TEST_ISI = 500;

var ISI = 500; // default, but they will tune this as desired with a slider
var MIN_ISI = 100;
var MAX_ISI = 3000;
var num_items_studied = 60; // CHANGE TO A SMALL NUMBER FOR TESTING
var list_repetitions = 1;
var time_per_stimulus = 750;
var mean_rt = 1109; // from existing data: median = 881, mean = 1109
var max_study_time = num_items_studied*list_repetitions*(time_per_stimulus+MAX_ISI);
var expected_test_time = 2*num_items_studied*(mean_rt + TEST_ISI) //
var instruct_reading_time = 120000; // estimate from existing data..
var total_exp_time = max_study_time + expected_test_time + instruct_reading_time;
//
console.log("estimated total experiment time: "+total_exp_time);
// 538080 / 60000 = 9 minutes

var IMG_DIR = "static/images/objects/";
var IMAGE_FILES = [];

for (var i = 1; i <= 123; i++) {
		IMAGE_FILES.push(IMG_DIR+i+".jpg");
}

var startTime;

// All pages to be loaded
var pages = [
	"instructions/instruct-1.html",
	"instructions/instruct-2.html",
	"instructions/instruct-quiz.html",
	"instructions/instruct-ready.html",
	"instructions/instruct-test.html",
	"instructions/instruct-filler.html",
	"slider.html",
	"stage.html",
	"postquestionnaire.html"
];

psiTurk.preloadImages(IMAGE_FILES);

psiTurk.preloadPages(pages);

var instructionPages = [
	"instructions/instruct-1.html",
	"instructions/instruct-quiz.html",
	"instructions/instruct-2.html"
];

var instructionsAfterSlider = [
	"instructions/instruct-ready.html"
];

var testInstructions = [
	"instructions/instruct-test.html"
];

var instructionFiller = [
	"instructions/instruct-filler.html"
];

var database = new Firebase('https://memtronomechoose.firebaseio.com');
var dbstudy = database.child("study"); // store data from each phase separately
var dbtest = database.child("test");
var dbinstructq = database.child("instructquiz");
var dbpostq = database.child("postquiz");
// callback to let us know when a new message is added: database.on('child_added', function(snapshot) {
//	var msg = snapshot.val();
//	doSomething(msg.name, msg.text);
// });

/********************
* HTML manipulation
*
* All HTML files in the templates directory are requested
* from the server when the PsiTurk object is created above. We
* need code to get those pages from the PsiTurk object and
* insert them into the document.
*
********************/

var instructioncheck = function() {
	var corr = [0,0,0,0,0];
	if (document.getElementById('icheck1').checked) {corr[0]=1;}
	if (document.getElementById('icheck2').checked) {corr[1]=1;}
	if (document.getElementById('icheck3').checked) {corr[2]=1;}
	if (document.getElementById('icheck4').checked) {corr[3]=1;}
	if (document.getElementById('icheck5').checked) {corr[4]=1;}
	var checksum = corr.reduce(function(tot,num){ return tot+num }, 0);
	console.log('instructquiz num_correct: ' + checksum);
	psiTurk.recordTrialData({'phase':'instructquiz', 'status':'submit', 'num_correct':checksum});
	startTime = new Date().getTime();
	dat = {'uniqueId':uniqueId, 'condnum':mycondition, 'phase':'instructquiz', 'num_correct':checksum, 'time':startTime};
	dbinstructq.push(dat);

	if (checksum===5){
		document.getElementById("checkquiz").style.display = "none"; // hide the submit button
		document.getElementById("instructquizcorrect").style.display = "inline"; // show the next button
	} else {
		alert('You have answered some of the questions wrong. Please re-read instructions and try again.');
	}
}

function getRandomColor() {
    var letters = '0123456789ABCDEF'.split('');
    var color = '#';
    for (var i = 0; i < 6; i++ ) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

var ChooseISI = function() {
	var myISI = ISI;
	psiTurk.showPage('slider.html');
	d3.select("#next")
		.on('click', function(d) {
			console.log("starting experiment with ISI: " +myISI);
			psiTurk.doInstructions(
    		instructionsAfterSlider,
    		function() { currentview = new Experiment(myISI); } // then do the study
    	);
		});

	$(function() {
		$('#slider').slider({
			min: MIN_ISI,
      max: MAX_ISI,
      value: myISI,

	    change: function(event, ui) {
	      //alert(ui.value);
	      clearInterval(beatHandle);
				myISI = ui.value;
	      showBeat(myISI);
	      console.log(myISI);
			}
		});
	});

  var svg = d3.select("#visual_stim").append("svg")
		.attr("width", 400)
		.attr("height", 300);

	var mySquare = svg.append("rect")
	  .attr("x",150)
	  .attr("y",100)
	  .attr("width",100)
	  .attr("height",100)
	  .attr("opacity",1e-6);

	var beatHandle;
	//var colors = ["blue","red","black","orange","green","yellow"];
	//var cyclesSeen = 0;
	var showBeat = function(curISI) {
		beatHandle = setInterval(function () {
			mySquare.transition()
				.attr('fill', function(d) { return getRandomColor(); })
				.style('opacity', 1)
				.duration(0)
				.delay(0)
				.each("end", function() {
					mySquare.transition()
						.style('opacity', 1e-6)
						.duration(0)
						.delay(time_per_stimulus);
				});
		}, curISI+time_per_stimulus);
	};


	showBeat(myISI);
}

var Experiment = function(myISI) {
	var wordon, // time word is presented
	    listening = false;

	var ISItype;
	var shuffle_trials = false;

	// give test subjects an id/condition:
	if(uniqueId==='') {
		uniqueId = Math.floor((Math.random() * 1000000) + 1);
		mycondition = "0";
	}

	//var ISI = ISI_LEVELS[parseInt(mycondition)]; // same ISI for all objects -- this is all we need!
	condition_name = "chooseISI";
	ISItype = "chosen";

	console.log("mycondition: "+mycondition+" condition_name: "+condition_name);

	var images = _.range(1,IMAGE_FILES.length);
	images = _.shuffle(images);
	objs = images.slice(0,num_items_studied); // to study
	var foil_inds = images.slice(num_items_studied+1, num_items_studied*2 +1 );
	console.log("num for study: "+objs.length+" num foils: "+foil_inds.length);

	//words = _.shuffle(VERBAL_STIM);
	var stimuli = []; // take first N
	for(i = 0; i<num_items_studied; i++) {
		stimuli.push({"obj":objs[i], "ISI":myISI, "index":i+1, "type":"old"}); // "word":words[i],
	}

	var trials = stimuli.slice(); // study trials
	//console.log(trials);
	// add foils for test
	for( i = 0; i<foil_inds.length; i++) {
		if(typeof foil_inds[i] === "undefined") {
			console.log("missing foil: " + i);
		}
		stimuli.push({"obj":foil_inds[i], "ISI":"NA", "index":0, "type":"new"});
	}
	stimuli = _.shuffle(stimuli);
	//console.log(stimuli);


	var next = function() {
		if (trials.length===0) {
			finish();
		}
		else {
			var stim = trials.shift();
			//var time = stim.ISI;
			wordon = new Date().getTime();

			show_stim( [stim], time_per_stimulus + stim.ISI, wordon );
		}
	};

	var finish = function() {
		d3.select("body").on("keydown", null);
	    // add a novel word/object pair for testing?
	    psiTurk.doInstructions(
    		testInstructions, // a list of pages you want to display in sequence
    		function() { currentview = new OldNewTest(stimuli); } // what you want to do when you are done with instructions
    	);
	};

	var record_study_trial = function(stim, wordon, key) {
		for(var i = 0; i < stim.length; i++) {
			var dat = {'uniqueId':uniqueId, 'condition':condition_name, 'phase':"STUDY", 'ISI':stim[i].ISI, 'index':stim[i].index,
				'obj':stim[i].obj, 'duration':time_per_stimulus, 'timestamp':wordon, 'keycode':key};
			//console.log(dat);
			psiTurk.recordTrialData(dat);
			dbstudy.push(dat);
		}
	};

	var show_stim = function(stim, time, wordon) {
		var recorded_flag = false;
		d3.select("body").on("keydown", function() {
			// 32 is space but let's record everything
			//if(d3.event.keyCode === 32) {	}
			record_study_trial(stim, wordon, d3.event.keyCode);
			recorded_flag = true;
		});

		//console.log(stim);
		var svg = d3.select("#visual_stim")
			.append("svg")
			.attr("width",250) // 480 if two stim
			.attr("height",250);

		svg.selectAll("image")
			.data(stim)
			.enter()
			.append("image")
      		.attr("xlink:href", function(d,i) { return IMG_DIR+d.obj+".jpg"; })
      		.attr("x", function(d,i) { return i*220+60 })
      		.attr("y", 10)
      		.attr("width",169)
      		.attr("height",169)
      		.style("opacity",1);

		// svg.selectAll("text")
		// 	.data(stim)
		// 	.enter()
		// 	.append("text")
		// 	.attr("x", function(d,i) { return i*220+50; })
		// 	.attr("y",180)
		// 	.style("fill",'black')
		// 	.style("text-align","center")
		// 	.style("font-size","50px")
		// 	.style("font-weight","200")
		// 	.style("margin","20px")
		// 	.text(function(d,i) { return d.word; });

		setTimeout(function() {
			if(!recorded_flag) { // record once if no keys were pressed
				record_study_trial(stim, wordon, -1);
			}
			remove_stim();
			setTimeout(function(){ next(); }, stim[0].ISI);
		}, time_per_stimulus); // time or time+ISI; ?
	};

	var remove_stim = function() {
		d3.select("svg").remove();
		// d3 transitions default to 250ms, and we probably don't want that fade..
		// d3.select("svg")
		// 	.transition()
		// 	.style("opacity", 0)
		// 	.remove();
	};


	// Load the stage.html snippet into the body of the page
	psiTurk.showPage('stage.html');
	// Start the test
	setTimeout(next(), 2000); // wait a bit to let the trial array be built...
};


var OldNewTest = function(stimuli) {
	// shuffle the words and present each one along with all of the objects
	// prompt them: "Choose the best object for"  (later: try choosing top two or three? or choose until correct?)
	stimuli = _.shuffle(stimuli); // shuffle...again
	//var all_objs = stimuli.slice(0);
	//all_objs = _.shuffle(all_objs); // and shuffle the object array
	var test_index = 0;
	var waiting = false;

	var finish = function() {
	    d3.select("body").on("keydown", null);
	    currentview = new Questionnaire();
	};

	var next = function() {
		waiting = false;
		if (stimuli.length===0) {
			finish();
		}
		else {
			var stim = stimuli.shift(); // remove words as tested
			test_index++;
			show_test( stim );
		}
	};

	var show_test = function( stim ) {
		wordon = new Date().getTime();
		var recorded_flag = false;
		var correct = 0;
		var response = -1;

		//console.log(stim);

		var svg = d3.select("#visual_stim")
			.append("svg")
			.attr("width",250)
			.attr("height",250);

		d3.select("body").on("keydown", function() {
			if(!waiting) {
				var valid_key = false;
				var rt = new Date().getTime() - wordon;
				// 32 is space but let's record everything
				if(d3.event.keyCode === 81) {	// 'Q'
					valid_key = true;
					response = 'new';
					if(stim.type==='new') correct = 1;
				} else if(d3.event.keyCode === 80) { // 'P'
					valid_key = true;
					response = 'old';
					if(stim.type==='old') correct = 1;
				}

				if(valid_key) {
					var dat = {'condition':condition_name, 'phase':"TEST", 'testIndex':test_index, 'studyIndex':stim.index, 'ISI':stim.ISI,
						'stimId':stim.obj, 'correctAns':stim.type, 'response':response, 'correct':correct, 'rt':rt};
						//console.log(dat);
						psiTurk.recordTrialData(dat);
						dat.uniqueId = uniqueId;
						dat.timestamp = wordon;
						dbtest.push(dat);
						remove_stim();
						waiting=true;
						setTimeout(function(){ next(); }, TEST_ISI); // always 500 ISI
				}
			} // wait for a valid keypress
		});

		//d3.select("#prompt").html('<h1>Click on the '+ stim.word +'</h1>');
		d3.select("#prompt").html('<h1>Q = New,   P = Old</h1>');

		svg.selectAll("image")
			.data([stim])
			.enter()
			.append("image")
		  		.attr("xlink:href", function(d,i) { return IMG_DIR+d.obj+".jpg"; })
		  		.attr("x", function(d,i) { return i*220+60 })
		  		.attr("y", 10)
		  		.attr("width",169)
		  		.attr("height",169)
		  		.style("opacity",1);


	};

	var remove_stim = function() {
		d3.selectAll("svg").remove();
	};

	psiTurk.showPage('stage.html');
	next();
};

var FillerTask = function() {
	// just make them classify color patches until the total experiment time is >= to max time (8min)
	var filler_index = 0;
	var waiting = false;

	var finish = function() {
	    d3.select("body").on("keydown", null);
			psiTurk.completeHIT();
	    //currentview = new Questionnaire();
	};

	var next = function() {
		var timeSoFar = Date.now() - startTime;
		console.log("remaining time: " + (total_exp_time-timeSoFar)/1000);
		waiting = false;
		if (timeSoFar>=total_exp_time) {
			finish();
		}
		else {
			filler_index++;
			show_test( getRandomColor() );
		}
	};

	var show_test = function( stimColor ) {
		wordon = new Date().getTime();
		var recorded_flag = false;
		var correct = 0;
		var response = -1;

		//console.log(stim);

		var svg = d3.select("#visual_stim")
			.append("svg")
			.attr("width",250)
			.attr("height",250)
			.attr("opacity",1);

		d3.select("body").on("keydown", function() {
			if(!waiting) {
				var valid_key = false;
				var rt = new Date().getTime() - wordon;
				// 32 is space but let's record everything
				if(d3.event.keyCode === 81) {	// 'Q'
					valid_key = true;
					response = 'blue';
				} else if(d3.event.keyCode === 80) { // 'P'
					valid_key = true;
					response = 'notblue';
				}

				if(valid_key) {
					var dat = {'condition':condition_name, 'phase':"FILLER", 'trialIndex':filler_index,
						'color':stimColor, 'response':response, 'rt':rt};
						console.log(dat);
						//psiTurk.recordTrialData(dat);
						dat.uniqueId = uniqueId;
						dat.timestamp = wordon;
						//dbfiller.push(dat); // could save this data...nah
						remove_stim();
						waiting=true;
						setTimeout(function(){ next(); }, 750);
				}
			} // wait for a valid keypress
		});

		d3.select("#prompt").html('<h1>Q = Blue,   P = Not Blue</h1>');

		svg.append("rect")
			.attr("fill", function(d,i) { return stimColor; })
			.attr("x", function(d,i) { return i*220+60; })
			.attr("y", 10)
			.attr("width",169)
			.attr("height",169)
			.style("opacity",1);
	};

	var remove_stim = function() {
		d3.selectAll("svg").remove(); // svg or rect?
	};

	psiTurk.showPage('stage.html');
	next();
};



function getRandomSubarray(arr, size) {
    var shuffled = arr.slice(0), i = arr.length, temp, index;
    while (i--) {
        index = Math.floor((i + 1) * Math.random());
        temp = shuffled[index];
        shuffled[index] = shuffled[i];
        shuffled[i] = temp;
    }
    return shuffled.slice(0, size);
}


/****************
* Questionnaire *
****************/

var Questionnaire = function() {
	var error_message = "<h1>Oops!</h1><p>Something went wrong submitting your HIT. This might happen if you lose your internet connection. Press the button to resubmit.</p><button id='resubmit'>Resubmit</button>";

	record_responses = function() {
		psiTurk.recordTrialData({'phase':'postquestionnaire', 'status':'submit'});
		dat = {'uniqueId':uniqueId, 'condition':condition_name, 'phase':'postquestionnaire'};
		$('textarea').each( function(i, val) {
			psiTurk.recordUnstructuredData(this.id, this.value);
			dat[this.id] = this.value;
		});
		$('select').each( function(i, val) {
			psiTurk.recordUnstructuredData(this.id, this.value);
			dat[this.id] = this.value;
		});
		dbpostq.push(dat);
	};

	prompt_resubmit = function() {
		document.body.innerHTML = error_message; // d3.select("body")
		$("#resubmit").click(resubmit);
	};

	resubmit = function() {
		document.body.innerHTML = "<h1>Trying to resubmit...</h1>";
		reprompt = setTimeout(prompt_resubmit, 10000);

		psiTurk.saveData({
			success: function() {
			    clearInterval(reprompt);
                //psiTurk.computeBonus('compute_bonus', function(){}); // was finish()
								psiTurk.completeHIT();
			},
			error: prompt_resubmit
		});
	};


	// Load the questionnaire snippet
	psiTurk.showPage('postquestionnaire.html');
	psiTurk.recordTrialData({'phase':'postquestionnaire', 'status':'begin'});

	$("#next").click(function () {
	    record_responses();
	    psiTurk.saveData({
            success: function(){
                //psiTurk.computeBonus('compute_bonus', function() {
								psiTurk.doInstructions(
						    	instructionFiller,
						    	function() { currentview = new FillerTask(); }
						    );
								//psiTurk.completeHIT();
            },
            error: prompt_resubmit});
	});

};

// Task object to keep track of the current phase
var currentview;

/*******************
 * Run Task
 ******************/
$(window).load( function(){
    psiTurk.doInstructions(
    	instructionPages, // a list of pages you want to display in sequence
    	function() { currentview = new ChooseISI(); } // what you want to do when you are done with instructions
    );
});
