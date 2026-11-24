(function () {
    'use strict';
    const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
    function dateKey(text, year) {
        const match=String(text||'').match(/\b(Jan\w*|Feb\w*|Mar\w*|Apr\w*|May|Jun\w*|Jul\w*|Aug\w*|Sep\w*|Oct\w*|Nov\w*|Dec\w*)\.?\s*(\d{1,2})/i);
        const foundYear=String(text||'').match(/\b(20\d{2})\b/);
        year=foundYear?foundYear[1]:year;
        if (!match || !year) return '';
        const month=months.indexOf(match[1].slice(0,3).toLowerCase())+1;
        const day=Number(match[2]);
        if (!month || day<1 || day>31) return '';
        return year+'-'+String(month).padStart(2,'0')+'-'+String(day).padStart(2,'0');
    }
    function start() {
        // Both strip rows deep-link to their meet on the schedule page (results open for the last meet).
        [['uc-next-details','uc-next-link','uc-next-title','View details for '],['uc-last-details','uc-last-link','uc-last-title','View results for ']].forEach(function (ids) {
        const details=document.getElementById(ids[0]);
        const link=document.getElementById(ids[1]);
        const title=document.getElementById(ids[2]);
        if (details && link && title) {
            const update=function () {
                const cfg=window.UCMeetBar||{};
                // "2026-27" seasons: Jan-Jun meets fall in the second year.
                const ym=String(cfg.seasonLabel||'').match(/\b(20\d{2})(?:[-–](\d{2}))?\b/);
                const mo=String(details.textContent).match(/\b(Jan|Feb|Mar|Apr|May|Jun)/i);
                const yr=ym?(ym[2]&&mo?'20'+ym[2]:ym[1]):'';
                const key=dateKey(details.textContent,yr);
                if (!key || !cfg.scheduleUrl || /No Results Yet|Season Complete/i.test(title.textContent)) return;
                const url=new URL(cfg.scheduleUrl,window.location.href);
                if (url.origin!==window.location.origin) return;
                url.searchParams.set('uc_meet',key);
                link.href=url.href;
                link.setAttribute('aria-label',ids[3]+title.textContent.trim());
            };
            update();
            const observer=new MutationObserver(update);
            [details,title].forEach(el=>observer.observe(el,{childList:true,characterData:true,subtree:true}));
        }
        });
        function openMeet() {
            const key=new URL(window.location.href).searchParams.get('uc_meet');
            if (!key || !/^20\d{2}-\d{2}-\d{2}$/.test(key)) return;
            const cards=document.querySelectorAll('.uc-xc-native-season--current .uc-xc-native-meet');
            for (const card of cards) {
                const date=card.querySelector('.uc-xc-native-date');
                const season=card.closest('details[data-year]');
                if (!date || dateKey(date.textContent,season?season.dataset.year:'')!==key) continue;
                if (season) season.open=true;
                const results=card.querySelector('details.uc-xc-native-toggle');
                if (results) results.open=true;
                card.id='uc-xc-meet-'+key;
                card.style.scrollMarginTop='120px';
                card.tabIndex=-1;
                requestAnimationFrame(function () { card.focus({preventScroll:true});card.scrollIntoView({block:'start',behavior:'instant'}); });
                return;
            }
        }
        openMeet();
    }
    if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true});else start();
}());
