/* Union Catholic page interactions. */
(function(){
  'use strict';

  function initAlumniDirectory(){
    var box=document.getElementById('alist');
    var search=document.getElementById('as');
    var year=document.getElementById('ay');
    var result=document.getElementById('ar');
    if(!box||!search||!year||!result)return;

    var D={
      "2026":[["Ciaran Brosnan","University of Virginia"],["Kiara Fleming","Villanova University"],["Jimmiea King","Temple University"],["Jacqueline Williams","Georgetown University"],["Henry May","Gettysburg College"],["Elijah McCoy","New Jersey Institute of Technology (NJIT)"],["Joelle Ruccio","Marywood University"],["Jola Strayhorn","Livingston College"],["Emmy O’Hearn","Bucknell University"],["Ella Solorzano","University of Richmond"]],
      "2025":[["Taylor Cox","University of Georgia"],["Michael Devine","Bucknell University"],["Taylor Aska","Duke University"],["Evan Weber","Lehigh University"],["Emma Muir","Rensselaer Polytechnic Institute (RPI)"],["Aidan Cichocki","Sacred Heart University"],["Emily Harrington","DeSales University"],["Noah Cooper","University of New Haven"],["Avery Atexide","Rutgers University"]],
      "2024":[["Jimmy Wischusen","University of Virginia"],["Peyton Hollis","Duke University"],["Courtney Kaiser","University of Pennsylvania"],["Vonya Gould","Monmouth University"],["Leah Gould","William & Mary"],["Alex Saldana","Quinnipiac University"],["Sean Wilson","Marist College"],["Justice Hicks","Fairleigh Dickinson University"],["Kevin Philistin","Caldwell University"],["Marcus McCoy","Stonehill College"],["Gavin Devine","Sacred Heart University"],["Alessandro Alvarez-Tullo","Quinnipiac University"]],
      "2023":[["Alexandra Bonn","Yale University"],["Ryan Cichocki","Saint Joseph’s University"],["Ajanae Thompson","Villanova University"],["Kaleigh Gunsiorowski","University of Notre Dame"],["Maameyaa Nyinah","University of North Carolina"],["Caudell Cajuste","Iona University"]],
      "2022":[["Shane Brosnan","Harvard University"],["Abby Granrath","College of the Holy Cross"],["Daniela Peralta","University of Dayton"],["Jada Mia Puryear","Columbia University"],["Sydney McDonald","College of the Holy Cross"],["Myles Plummer","University of Virginia"],["Nick Givan","Georgetown University"],["Cameron Campbell-Miller","Saint Joseph’s University"],["Jenna Keith","New Jersey Institute of Technology (NJIT)"],["Ashlee Okunonke","Manhattan University"],["Asydiah Pray-Brown","Morgan State University"]],
      "2021":[["Morgan Williams","Hampton University"],["Avery Jordan","Quinnipiac University"],["A’Liyah Thomas","University of Connecticut"],["Matt Granizo","The College of New Jersey (TCNJ)"]],
      "2020":[["Sadie Abood","Catholic University"],["Matt Axt","Monmouth University"],["Elijah Brown","George Mason University"],["Morgan Jackson","Rider University"],["Leena Morant","Penn State University"],["Chi Chi Nkulume","Temple University"],["Ashleigh Patterson","UNC Asheville"],["Felicia Quainoo","University of Connecticut"],["Conor Reilly","Lehigh University"],["Sydney Tucker","Towson University"],["Zamira Ysaac","St. John’s University"],["Tyhir Jones","Monroe College"]],
      "2019":[["Alexandra Borik","Lafayette College"],["Uchenna Duru","University of Hartford"],["Khamil Evans","Northeastern University"],["Hope Handlin","Sacred Heart University"],["Jerika Lufrano","La Salle University"],["Jared Ware","Widener University"],["Justin Jimerson","Kean University"]],
      "2018":[["Christian Albanese","University of New Haven"],["Kira Alexander","Montclair State University"],["Justin Cadas","Fairleigh Dickinson University"],["Amaya Chadwick","Purdue University"],["Silas Donaus","University of New Haven"],["Brianna Ewing","University of Maine"],["Trevor Garrity","Marist College"],["Sophia Martinez","Rutgers University–Newark"],["Brandon Patterson","Coffeyville Community College"],["Christina Samuels","Wagner College"],["Tyler Scott","University of Connecticut"],["Krishna White","Long Island University"]],
      "2017":[["Isaac Eason","Virginia State University"],["Greg Gibbs","Barton College"],["Brendan McCabe","High Point University"],["Sydney McLaughlin","University of Kentucky"],["Tressa Novack","Assumption University"],["Nate Papachristos","Earlham College"],["Branden Roach","Mount St. Mary’s University"]],
      "2016":[["Perry Christie","Rutgers University"],["Tatiana Ifill","Caldwell University"],["Victoria Isidron","Salisbury University"],["Asia Johnson","Hampton University"],["Tia Livingston","University of Pennsylvania"],["Matius Moncada","University of New Haven"],["Amari Onque-Shabazz","Villanova University"],["Karan Patel","St. Bonaventure University"],["Trae Robinson","Saint Joseph’s University"],["Alexei Tyburczy","Stockton University"],["Bishop Williams","Nyack College"]],
      "2015":[["Sean Brennan","United States Naval Academy"],["Jordan Coverson","Boston University"],["DJ Florendo","Assumption University"],["Janelle Gibbs","Monmouth University"],["Serge Gilbert","American International College"],["Caitlin Glynn","Jacksonville University"],["Bria Henry","Hampton University"],["Alana Herran","University of Virginia"],["Taylor McLaughlin","University of Michigan"],["Chandi Piiru","Monmouth University"],["Dalon Ryles","Seton Hill University"],["Brian Sagendorf","Mount St. Mary’s University"]],
      "2014":[["Obafemi Animashaun","University of North Carolina"],["Imani Beauliere","Rutgers University"],["Kenny Evely","Saint Joseph’s University"],["Steve Franco","Rider University"],["Andrew Ghizzone","University of Colorado"],["Mike Herron","Saint Peter’s University"],["Jordan Jimerson","Rutgers University"],["JP Seebode","Stevens Institute of Technology"]],
      "2013":[["Christian Barbosa","Franklin Pierce University"],["Mike DeAngelis","Manhattan College"],["Zach Ghizzone","Rutgers University"],["Tyrell Gibbs","Monmouth University"],["Tom Sagendorf","Immaculata University"],["Christoffe Scott","Hampton University"],["Tom Wang","Tufts University"]],
      "2012":[["Allen Eke","University of Oklahoma"],["Tommy Freid","East Stroudsburg University"],["Morgan McLaughlin","Saint Peter’s University"],["Braeden Rembert","Kutztown University"]],
      "2011":[["Alexis Cubbage","Lincoln University (PA)"],["Evan Gingrich","High Point University"],["Brandon Kelly","Saint Peter’s University"],["Joe Seebode","College of the Holy Cross"]],
      "2010":[["Mike Cahill","Stevens Institute of Technology"],["Kevin Mulligan","Monmouth University"],["Matt O’Donnell","University of Delaware"],["DJ Thornton","University of Notre Dame"]],
      "2009":[["Danny da Costa","Saint Joseph’s University"],["Caryn Grabowski","Kutztown University"],["Shariff Stubbs","Rutgers University–Newark"]],
      "2008":[["Garrett Ellis","Bethune-Cookman University"],["Ryan Kilkenny","Bentley University"],["Obinna Nwafor","University of Connecticut"],["Samantha Peters","Saint Joseph’s University"]],
      "2007":[["Kaity Eppinger","Wagner College"],["Brian Guterl","Saint Joseph’s University"],["Chris Pegeron","Kean University"],["Jen Seniszyn","Rider University"],["Mike Sprague","University of North Florida"]],
      "2006":[["Lesley Hendricks","New Jersey Institute of Technology (NJIT)"],["Nick Morrisey","University of Delaware"]]
    };

    var total=154;
    function esc(v){return String(v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
    function draw(){
      var q=(search.value||'').trim().toLowerCase();
      var selected=year.value;
      var count=0;
      var html='';
      Object.keys(D).sort(function(a,b){return b-a;}).forEach(function(k){
        if(selected&&selected!==k)return;
        var alumni=D[k].filter(function(x){return !q||(x[0]+' '+x[1]).toLowerCase().indexOf(q)>-1;});
        if(!alumni.length)return;
        count+=alumni.length;
        var open=(+k>=2024||q||selected)?' open':'';
        html+='<details class="yr"'+open+'><summary>Class of '+k+'<i>'+alumni.length+' alumni</i></summary><div class="grid">'+alumni.map(function(x){return'<article class="ae"><b>'+esc(x[0])+'</b><span>'+esc(x[1])+'</span></article>';}).join('')+'</div></details>';
      });
      box.innerHTML=html;
      result.textContent='Showing '+count+' of '+total+' verified alumni';
    }
    search.addEventListener('input',draw);
    year.addEventListener('change',draw);
    draw();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initAlumniDirectory);else initAlumniDirectory();
})();
