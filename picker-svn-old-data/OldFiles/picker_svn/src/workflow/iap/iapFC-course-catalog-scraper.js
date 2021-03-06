var rdf = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
var dc = 'http://purl.org/dc/elements/1.1/';

var namespace = document.documentElement.namespaceURI;
var nsResolver = namespace ? function(prefix) {
  return (prefix == 'x') ? namespace : null;
} : null;

var getNode = function(document, contextNode, xpath, nsResolver) {
  return document.evaluate(xpath, contextNode, nsResolver, XPathResult.ANY_TYPE,null).iterateNext();
}

var cleanString = function(s) {
  return utilities.trimString(s);
}

var getText = function(elmt, xpath) {
  return cleanString(getNode(document, elmt, xpath, nsResolver).nodeValue);
}
var getAttribute = function(elmt, xpath, attr) {
  return cleanString(getNode(document, elmt, xpath, nsResolver)[attr]);
}

var xpath = '/html/body/blockquote/center/p/table/tbody/tr[2]/td/table/tbody/tr/td';
var elements = utilities.gatherElementsOnXPath(document, document, xpath, nsResolver);
var classOutput = [];
var sectionOutput = [];
var lectureOutput = [];

for (var i = 0; i < elements.length; i++) {
  	var element = elements[i];

	try {
		var bolds = utilities.gatherElementsOnXPath(document, element, './font/B', nsResolver);
		if (bolds.length == 3) {
			var classNumber = cleanString(bolds[0].firstChild.nodeValue);
			var courseType = cleanString(bolds[1].firstChild.nodeValue);
			var courseName = cleanString(bolds[2].firstChild.nodeValue);
		}
		if (bolds.length == 2) {
			var classNumber = cleanString(bolds[0].firstChild.nodeValue);
			var courseType = "";
			var courseName = cleanString(bolds[1].firstChild.nodeValue);
		}
		if (bolds.length == 1) {
			var classNumber = "";
			var courseType = "";
			var courseName = cleanString(bolds[0].firstChild.nodeValue);
		}
	} catch (e) { 
	continue;
	}
  
	var instructors = [];
	try {
		var italics = utilities.gatherElementsOnXPath(document, element, './I', nsResolver);
		var names = cleanString(italics[0].textContent).split(',');
		for (var j = 0; j < names.length; j++) {
			var name = cleanString(names[j]);
			var space = name.lastIndexOf(' ');
			if (space > 0) {
				name = name.substr(space + 1) + ", " + name.substr(0, space);
			}
			instructors.push(name);
		}
	} catch (e) { 
		continue;
	}
	
	var datesTimes = [];
	var courseInfo = [];
	try {
		var fonts = utilities.gatherElementsOnXPath(document, element, './font', nsResolver);
		var meetingInfo = cleanString(fonts[bolds.length].textContent).split(',');
		for (var j = 0; j < meetingInfo.length - 1; j++) {
			datesTimes.push(cleanString(meetingInfo[j]));
		}
		var location = meetingInfo[(meetingInfo.length - 1)];
		for (var j = bolds.length + 1; j < fonts.length; j++) {
			var info = cleanString(fonts[j].textContent);
			courseInfo.push(info);
		}
	} catch (e) { 
		continue;
	}
	
	try {
		var node = fonts[fonts.length - 1].nextSibling.nextSibling.nextSibling.nextSibling.nextSibling;
		var description = cleanString(node.textContent);
	} catch (e) { 
		continue;
	}
	
	try {
		var links = utilities.gatherElementsOnXPath(document, element, './a', nsResolver);
		var url = "http://web.mit.edu/iap"
		var contact = "Look online for contact info"
		if (links.length > 0) {
			url = cleanString(links[0].textContent);
			contact = cleanString(links[0].nextSibling.nextSibling.nextSibling.textContent);
		}
	} catch (e) { 
		continue;
	}
	
	for (var d = 0; d < datesTimes.length; d++) {
		var lecture = "L-" + classNumber + "-" + datesTimes[d] + "-" + location;
		var lectureString = "Lecture" +
		 "\ts" + classNumber + 'a' +
		 "\t" + lecture + 
		 "\t" + datesTimes[d] +
		 "\t" + location;
		lectureOutput.push(lectureString);
	}

	var sectionString = "Section" + 
	 "\ts" + classNumber + 'a' +
	 "\tc" + classNumber + 
	 "\t" + instructors.join("; ");
	sectionOutput.push(sectionString);
	
	var classString = "Class" + 
    "\tc" + classNumber + 
    "\t" + courseName +
    "\t" + courseType +
    "\t" + classNumber + " - " + courseName +
    "\t" + instructors.join("; ") +
    "\t" + description +
    "\t" + courseInfo.join("; ") + 
    "\t" + url +
    "\t" + contact;
  classOutput.push(classString);
}

//log("type \tid \tcourse \tcategory \tlabel \tin-charge \tdescription:single \tcourseInfo \turl:url \tcontact");
for (var i = 0; i < classOutput.length; i++) { log(classOutput[i]); }
//log("type \tlabel \tclass \tinstructor");
for (var i = 0; i < sectionOutput.length; i++) { log(sectionOutput[i]); }
//log("type \tlabel \tsection \tdateTime \troom");
for (var i = 0; i < lectureOutput.length; i++) { log(lectureOutput[i]); }