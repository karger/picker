/*==================================================
 * Exhibit extensions
 *==================================================
 */
var debug = false;

Exhibit.Functions["building"] = {
    f: function(args) {
        var building = "";
        args[0].forEachValue(function(v) {
            building = v.split("-")[0];
            return true;
        });
        return new Exhibit.Expression._Collection([ building ],  "text");
    }
};

/*==================================================
 * Initialization
 *==================================================
 */

var hasTQE = false; 

function onLoad() {
	SimileAjax.Debug.silent = true;
    
    var urls = [ ];
    var query = document.location.search;
    if (query.length > 1) {
        var params = query.substr(1).split("&");
        for (var i = 0; i < params.length; i++) {
            var a = params[i].split("=");
            var name = a[0];
            var value = a.length > 1 ? decodeURIComponent(a[1]) : "";
            if (name == "courses") {
            	var courseIDs = value.split(";");
				addCourses(courseIDs, urls);
            } else if (name == "debug") {
                debug = true;
            }
        }
    }
    urls.push("data/schema.js");

    window.database = Exhibit.Database.create();
    
    var fDone = function() {
        document.getElementById("schedule-preview-pane").style.display = "block";
        document.getElementById("browsing-interface").style.display = "block";
        
        var pickedSections = new Exhibit.Collection("picked-sections", window.database);
        pickedSections._update = function() {
            this._items = this._database.getSubjects("true", "picked");
            this._onRootItemsChanged();
        };
        pickedSections._update();
        
        if (hasTQE) {
            var tqeDiv = document.getElementById("tqe-facet");
            tqeDiv.onclick = function() { makeFacet(this); };
            tqeDiv.setAttribute("ex:role", "facet");
            tqeDiv.setAttribute("ex:expression", ".TQE");
            tqeDiv.setAttribute("ex:facetLabel", "TQE &raquo;");
        }
        
        window.exhibit = Exhibit.create();
        window.exhibit.setCollection("picked-sections", pickedSections);
        window.exhibit.configureFromDOM();
        
        setupExistingFacet(document.getElementById("category-facet"));
        setupExistingFacet(document.getElementById("semester-facet"));
        setupExistingFacet(document.getElementById("offering-facet"));
        if (hasTQE) {
            setupExistingFacet(document.getElementById("tqe-facet"));
        }
        
        enableMiniTimegrid();
        enableUnitAdder();
        fillAddMoreSelect();
    };
    loadURLs(urls, fDone);
}

function addCourses(courseIDs, urls) { 
    var coursesA = [];
    var exceptions = {
        "9": true
    };
    
    for (var i = 0; i < courseIDs.length; i++) {
        if (courseIDs[i] != "hass_d") {
            if (!debug && courseIDs[i] in exceptions) {
                urls.push("data/spring-fall/exceptions/" + courseIDs[i] + ".json");
            } else {
                coursesA.push(courseIDs[i]);
            }
        }
    }
    /* warehouse service is out of date, mit open data loaded below
	var coursesString = coursesA.join(";");
	if (coursesString != "" && coursesString != null) {
        urls.push('http://isda-ws2.mit.edu/WarehouseService/?courses=' + coursesString);
	}
	*/
	for (var c = 0; c < courseIDs.length; c++) {
		var courseID = courseIDs[c];
		/* we have data for everything, so this doesn't seem necessary
		if (!courses[courseID].hasData) {
    		alert("Oops! We actually don't have the data for this course.");
    		return; 
    	}*/
		urls.push("data/spring-fall/scraped-data/" + courseID + ".json");
		urls.push("data/spring-fall/open-data/" + courseID + ".json");
		if (courseID == "6") {
			urls.push("data/tqe.json");
			urls.push("data/hkn.json");
			//urls.push("data/wtw-6sp08.json");
			hasTQE = true;
		}
		markLoaded(courseID);
	}
}

function loadMoreClass(button) {
    var classID = button.getAttribute("classID");
    var course = classID.split(".")[0];
    var urls = [];
    addCourses([course], urls);
    
    SimileAjax.WindowManager.cancelPopups();
    loadURLs(urls, function(){});
}

function markLoaded(courseID) {
    for (var i = 0; i < courses.length; i++) {
        var course = courses[i];
        if (courseID == course.number) {
            course.loaded = true;
            return;
        }
    }
}

function fillAddMoreSelect() {
    var select = document.getElementById("add-more-select");
    select.innerHTML = "";
    
    var option = document.createElement("option");
    option.value = "";
    option.label = "add more courses";
    option.text = "add more courses";
    select.appendChild(option);
    
    for (var i = 0; i < courses.length; i++) {
        var course = courses[i];
        if (course.hasData && !(course.loaded)) {
            var label = course.number + " " + course.name;
            option = document.createElement("option");
            option.value = course.number;
            option.label = label;
            option.text = label;
            select.appendChild(option);
        }
    }
}

function onAddMoreSelectChange() {
    var select = document.getElementById("add-more-select");
    var course = select.value;
    if (course.length > 0) {
        var urls = [];
        addCourses([course], urls);
        
        SimileAjax.WindowManager.cancelPopups();
        
        Exhibit.UI.showBusyIndicator();
        loadURLs(urls, function(){ 
            Exhibit.UI.hideBusyIndicator();
            fillAddMoreSelect(); 
        });
    }
}

function loadURLs(urls, fDone) {
    var fNext = function() {
        if (urls.length > 0) {
            var url = urls.shift();
            if (url.search(/http/) == 0) {
            	Exhibit.importers["application/jsonp"].load(
                    url, window.database, fNext, postProcessOfficialData);
            } else {
            	loadScrapedData(url, window.database, fNext);
            }
        } else {
            fDone();
        }
    };
    fNext();
}

// not used anymore
function postProcessOfficialData(json) {
    var items = json.items;				
    for (var i = 0; i < items.length; i++) {
        postProcessOfficialDataItem(items[i]);
    }					
    return json;
}

// not used anymore
function postProcessOfficialDataItem(item) {
    if ('offering' in item) {
        item.offering == 'Y'?item.offering = 'Currently Offered':item.offering = 'Not offered this year';
    }
    if (item.type == 'LectureSession') {
        item.type = 'LectureSection';
        item["lecture-section-of"] = item["section-of"];
        delete item["section-of"];
    } 
    if (item.type == 'RecitationSession') {
        item.type = 'RecitationSection';
        item["rec-section-of"] = item["section-of"];
        delete item["section-of"];
    } 
    if (item.type == 'LabSession') {
        item.type = 'LabSection';
        item["lab-section-of"] = item["section-of"];
        delete item["section-of"];
    } 
    if ('prereqs' in item) {
        if (item.prereqs == "") {
            item.prereqs = "--";
        }
        while (item.prereqs.search(/[\]\[]/) >= 0 ) {
            item.prereqs = item.prereqs.replace(/[\]\[]/, "");
        }
        var matches = item.prereqs.match(/([^\s\/]+\.[\d]+\w?)/g);
        if (matches != null) {
            var s = item.prereqs;
            var output = "";
            var from = 0;
            for (var m = 0; m < matches.length; m++) {
                var match = matches[m];
                var i = s.indexOf(match, from);
                var replace = 
                    "<a href=\"javascript:{}\" onclick=\"showPrereq(this, '" +
                        match.replace(/J/, "")+"');\">" + match + "</a>";
                
                output += s.substring(from, i) + replace;
                from = i + match.length;
            }
            item.prereqs = output + s.substring(from);
        }
        /*if (item.prereqs.search(/;/) >= 0) {
            while (item.prereqs.search(/or/) > 0) {
                item.prereqs = item.prereqs.replace(/or/, ",");
            }
        } else if (item.prereqs.search(/or/) >= 0) {
            while (item.prereqs.search(/or/) > 0) {
                item.prereqs = item.prereqs.replace(/or/, ",");
            }
        } else {
            while (item.prereqs.search(/,/) >= 0) {
                item.prereqs = item.prereqs.replace(/,/, ";");
            }
        }
        while (item.prereqs.search(/[a-zA-Z\s]/) >= 0 ) {
            item.prereqs = item.prereqs.replace(/[a-zA-Z\s\]\[]/, "");
        }*/
    }
    if ('timeAndPlace' in item) {
        if (item.timeAndPlace.search(/ARRANGED/) >= 0 || item.timeAndPlace.search(/null/) >= 0) {item.timeAndPlace = 'To be arranged';}
    } 
}

function loadScrapedData(link, database, cont) {
    var url = typeof link == "string" ? link : link.href;
    url = Exhibit.Persistence.resolveURL(url);

    var fError = function(statusText, status, xmlhttp) {
        Exhibit.UI.hideBusyIndicator();
        Exhibit.UI.showHelp(Exhibit.l10n.failedToLoadDataFileMessage(url));
        if (cont) cont();
    };
    
    var fDone = function(xmlhttp) {
        Exhibit.UI.hideBusyIndicator();
        try {
            var o = null;
            try {
                o = eval("(" + xmlhttp.responseText + ")");
            } catch (e) {
                Exhibit.UI.showJsonFileValidation(Exhibit.l10n.badJsonMessage(url, e), url);
            }
            
            if (o != null) {
                if (url.indexOf("/exceptions/") >= 0) {
                    o = postProcessOfficialData(o);
                } else {
                	// this is all data now - open and scraped
                    o = postProcessStaticData(o);
            	}
                database.loadData(o, Exhibit.Persistence.getBaseURL(url));
            }
        } catch (e) {
            SimileAjax.Debug.exception(e, "Error loading Exhibit JSON data from " + url);
        } finally {
            if (cont) cont();
        }
    };

    Exhibit.UI.showBusyIndicator();
    SimileAjax.XmlHttp.get(url, fError, fDone);
};

// not used anymore
function postProcessScrapedData(o) {
    if ("items" in o) {
        var items = o.items;
        for (var j = 0; j < items.length; j++) {
            var item = items[j];
            if (database.containsItem(item.id)) {
                if ('label' in item) {delete item.label;} 
                if ('course' in item) {delete item.course;} 
                if ('level' in item) {delete item.level;} 
                if ('units' in item) {delete item.units;} 
                if ('total-units' in item) {delete item["total-units"];} 
                if ('description' in item) {delete item.description;} 
                if ('semester' in item) {delete item.semester;} 
                if ('offering' in item) {delete item.offering;} 
                if ('prereq' in item) {delete item.prereq;} 
                if ('in-charge' in item) {delete item["in-charge"];} 
            }
        }
    }
    return o;
};

// processes open and scraped data
function postProcessStaticData(o) {
	if ("items" in o) {
        var items = o.items;
        for (var j = 0; j < items.length; j++) {
            var item = items[j];
			if ('prereqs' in item) {
				if (item.prereqs == "") {
					item.prereqs = "--";
				}
				while (item.prereqs.search(/GIR:/) >= 0) {
					gir = item.prereqs.match(/GIR:.{4}/);
					item.prereqs = item.prereqs.replace(/GIR:.{4}/, girData[gir].join(" or "));
				}
				while (item.prereqs.search(/[\]\[]/) >= 0 ) {
					item.prereqs = item.prereqs.replace(/[\]\[]/, "");
				}
				var matches = item.prereqs.match(/([^\s\/]+\.[\d]+\w?)/g);
				if (matches != null) {
					var s = item.prereqs;
					var output = "";
					var from = 0;
					for (var m = 0; m < matches.length; m++) {
						var match = matches[m];
						var i = s.indexOf(match, from);
						var replace = 
							"<a href=\"javascript:{}\" onclick=\"showPrereq(this, '" +
								match.replace(/J/, "")+"');\">" + match + "</a>";
						
						output += s.substring(from, i) + replace;
						from = i + match.length;
					}
					item.prereqs = output + s.substring(from);
				}
			}
			if ('timeAndPlace' in item) {
				if (typeof item.timeAndPlace != "string") {
					item.timeAndPlace = item.timeAndPlace.join(", ");
				} 
				if (item.timeAndPlace.search(/ARRANGED/) >= 0 || item.timeAndPlace.search(/null/) >= 0) {
					item.timeAndPlace = 'To be arranged';
				}
			}
			if ('units' in item) {
				if (item.units == '0-0-0' || item.units == 'unknown') {
					item.units = 'Arranged';
				}
			}
		}
	}
	return o;
}

function showPrereq(elmt, itemID) {
    Exhibit.UI.showItemInPopup(itemID, elmt, exhibit.getUIContext());
}

/*==================================================
 * Panel switching and facet toggling
 *==================================================
 */
function onShowScheduleDetails() {
    SimileAjax.History.addLengthyAction(
        showScheduleDetails,
        showSchedulePreview,
        "Show Schedule Details"
    );
}

function onShowSchedulePreview() {
    SimileAjax.History.addLengthyAction(
        showSchedulePreview,
        showScheduleDetails,
        "Show Classes"
    );
}

function showScheduleDetails() {
    document.getElementById("classes-layer").style.visibility = "hidden";
    document.getElementById("schedule-preview-pane").style.visibility = "hidden";
    
    document.getElementById("schedule-details-layer").style.visibility = "visible";
    
    document.body.scrollTop = 0;
}

function showSchedulePreview() {
    document.getElementById("schedule-details-layer").style.visibility = "hidden";
    
    document.getElementById("classes-layer").style.visibility = "visible";
    document.getElementById("schedule-preview-pane").style.visibility = "visible";
    
    document.body.scrollTop = 0;
}

function setupExistingFacet(div) {
    div.firstChild.onclick = function() { unmakeFacet(div); }
}

function makeFacet(div) {
    div.className = "";
    
    var facet = Exhibit.UI.createFacet(facetData[div.id], div, window.exhibit.getUIContext());    
    window.exhibit.setComponent(div.id, facet);
    
    div.firstChild.onclick = function() { unmakeFacet(div); }
    div.onclick = null;
};

function unmakeFacet(div) {
    var facet = window.exhibit.getComponent(div.id);
    if (facet.hasRestrictions() && !window.confirm("You have something selected in this facet. OK to clear your selection?")) {
        return;
    }
    
    window.exhibit.disposeComponent(div.id);
    
    div.innerHTML = facetData[div.id].facetLabel;
    div.className = "collapsed-facet";
    div.onclick = function() { makeFacet(div); };
}

/*==================================================
 * Favorites
 *==================================================
 */
function toggleFavorite(img) {
    var classID = img.getAttribute("classID");
    var favorite = window.database.getObject(classID, "favorite") == "true";
    if (favorite) {
        SimileAjax.History.addLengthyAction(
            function() { undoFavorite(classID, img) },
            function() { doFavorite(classID, img) },
            "Unfavorite " + classID
        );
        
    } else {
        SimileAjax.History.addLengthyAction(
            function() { doFavorite(classID, img) },
            function() { undoFavorite(classID, img) },
            "Favorite " + classID
        );
    }
}

function doFavorite(classID, img) {
    window.database.addStatement(classID, "favorite", "true");
    img.src = "images/yellow-star.png";
}

function undoFavorite(classID, img) {
    window.database.removeStatement(classID, "favorite", "true");
    img.src = "images/gray-star.png";
}

function processShowOnlyFavoriteClass(checkbox) {
    if (checkbox.checked) {
        SimileAjax.History.addLengthyAction(
            function() { showFavoritesOnly(); checkbox.checked = true; },
            function() { showAllClasses(); checkbox.checked = false; },
            "Show favorites only"
        );
    } else {
        SimileAjax.History.addLengthyAction(
            function() { showAllClasses(); checkbox.checked = false; },
            function() { showFavoritesOnly(); checkbox.checked = true; },
            "Show all classes"
        );
    }
};

function showFavoritesOnly() {
    var collection = window.exhibit.getDefaultCollection();
    collection._items = window.database.getSubjects("true", "favorite");
    collection._onRootItemsChanged();
}

function showAllClasses() {
    var collection = window.exhibit.getDefaultCollection();
    collection._items = window.database.getSubjects("Class", "type");
    collection._onRootItemsChanged();
}

/*==================================================
 * Section picking
 *==================================================
 */

function onPickUnpick(button) {
    var sectionID = button.getAttribute("sectionID");
    var picked = window.database.getObject(sectionID, "picked") == "true";
    if (picked) {
        SimileAjax.History.addLengthyAction(
            function() { doUnpick(sectionID) },
            function() { doPick(sectionID) },
            "Unpicked " + sectionID
        );
    } else {
        SimileAjax.History.addLengthyAction(
            function() { doPick(sectionID) },
            function() { doUnpick(sectionID) },
            "Picked " + sectionID
        );
    }
};

function onUnpick(button) {
    var sectionID = button.getAttribute("sectionID");
    SimileAjax.History.addLengthyAction(
        function() { doUnpick(sectionID) },
        function() { doPick(sectionID) },
        "Unpicked " + sectionID
    );
};

function doPick(sectionID) {
    window.database.addStatement(sectionID, "picked", "true");
    window.database.addStatement(sectionID, "color", getNewColor());
    window.database.removeStatement(sectionID, "temppick", "true");
    
    window.exhibit.getCollection("picked-sections")._update();

    showHidePickDiv(sectionID, true);
}
function doUnpick(sectionID) {
    var color = window.database.getObject(sectionID, "color");
    releaseColor(color);
    
    window.database.removeStatement(sectionID, "picked", "true");
    window.database.removeStatement(sectionID, "color", color);
    
    window.exhibit.getCollection("picked-sections")._update();
    
    showHidePickDiv(sectionID, false);
}

function onMouseOverSection(div) {
    //if (!SimileAjax.Platform.browser.isIE) {
        var sectionID = div.getAttribute("sectionID");
        if (window.database.getObject(sectionID, "picked") == null) {
            updateMiniTimegrid(true, sectionID);
        }
    //}
}
function onMouseOutSection(div) {
    //if (!SimileAjax.Platform.browser.isIE) {
        var sectionID = div.getAttribute("sectionID");
        if (window.database.getObject(sectionID, "picked") == null) {
            updateMiniTimegrid(true, null);
        }
    //}
}
function showHidePickDiv(sectionID, picked) {
    var thediv = document.getElementById("divid-" + sectionID);
    if (thediv != null) {
        thediv.className = picked ? "each-section-picked" : "each-section-unpicked";
        
        var button = thediv.getElementsByTagName("button")[0];
        button.innerHTML = picked ? "Remove" : "Add";
    }
}
