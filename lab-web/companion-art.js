// Authored in local bone coordinates. Geometry is separate from motion and expression.
const upperArm=side=>`<g class="girl-upper-arm girl-upper-arm-${side}" data-upper="${side}"><circle r="10.5" fill="#639e85"/><path d="M0-10Q25-12 54-9L54 9Q25 13 0 11Z" fill="#639e85"/><path d="M5 7Q28 11 52 7" stroke="#437d68" stroke-width="3" fill="none"/></g>`;
const forearm=side=>`<g data-arm-chain="${side}"><g class="girl-forearm girl-forearm-${side}" data-lower="${side}"><circle r="9.5" fill="#639e85"/><path d="M0-9 40-7 43 7 0 10Z" fill="#72ac92"/><path d="m4 7 34-2" stroke="#4c8b72" stroke-width="2.5"/><path d="M37-7 45-6 45 6 37 7Z" fill="#a3c9ae"/><g class="girl-hand girl-hand-${side}" data-hand="${side}" transform="translate(48 0)"><path d="M-3-5Q2-7 8-4L13-2Q17-1 15 2L9 6 0 5Q-5 4-3-5Z" fill="url(#rig-skin)"/><path d="m1 3 4 5q3 2 5-1L7 3" fill="#e4b598"/><path data-fingers="${side}" d="m7-2 6 1m-7 2 6 0m-7 2 4 0" fill="none" stroke="#bf8b72" stroke-width=".8" stroke-linecap="round"/></g></g></g>`;
const leg=side=>`<g class="girl-leg girl-leg-${side}" data-thigh="${side}"><circle r="13" fill="#2f434b"/><path data-thigh-shape="${side}" d="M0-13Q32-13 62-10L62 11Q32 15 0 13Z" fill="#2f434b"/><path data-thigh-shadow="${side}" d="m8 9 48-1" stroke="#263941" stroke-width="3"/><g class="girl-shin girl-shin-${side}" data-shin="${side}" transform="translate(62 0)"><circle r="11" fill="#30464f"/><path d="M0-11 60-9 62 9 0 11Z" fill="#30464f"/><path d="m5 8 51-1" stroke="#213740" stroke-width="2"/><g data-foot="${side}" transform="translate(62 0)"><path data-front-shoe="${side}" d="M-11-6Q0-11 10-5L15 6Q14 10-12 10-16 5-11-6Z" fill="#e9e5d5"/><path data-side-shoe="${side}" d="M-9-7Q1-11 8-3L22 3Q28 9 19 10H-11Q-15 4-9-7Z" fill="#e9e5d5" opacity="0"/><path d="m-9 7 22 0m-11-10 7 2m-8 1 8 2" stroke="#819a8a" stroke-width="1.5" stroke-linecap="round"/></g></g></g>`;

export function girlIllustration(){return `<svg class="nexo-girl" viewBox="0 0 420 460" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">
<defs><linearGradient id="rig-skin" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f1ceb2"/><stop offset="1" stop-color="#dfac8d"/></linearGradient></defs>
<path d="M37 424H383" fill="none" stroke="#70977e" stroke-width="1" opacity=".28"/>
<ellipse data-shadow cx="210" cy="427" rx="51" ry="6" fill="#03130e" opacity=".3"/>
<g data-actor>
<g data-chair opacity="0"><path d="M-40 254Q0 244 40 254L37 330H-38Z" fill="#31554b"/><path d="M-45 328Q0 321 45 328V337H-45Z" fill="#547566"/><path d="m-32 336-8 86m70-86 9 86" stroke="#446255" stroke-width="7" stroke-linecap="round"/></g>
${leg('left')}${leg('right')}
<g data-pelvis><path d="M-32-13Q0-7 33-13L35 8Q2 18-35 8Z" fill="#2d424a"/><path d="M-29-9Q0-5 30-9" fill="none" stroke="#1c343b" stroke-width="3"/></g>
<path data-hair-back fill="#2c2929"/>
<path data-torso fill="#67a68b" stroke="#538e77" stroke-width="1"/>
<path data-shirt fill="#e3e2ce"/><path data-jacket-shade fill="#49876f"/><path data-lapel fill="none" stroke="#356b56" stroke-width="2" stroke-linejoin="round"/>
<path data-neck fill="url(#rig-skin)"/>
${upperArm('left')}${upperArm('right')}
<g class="girl-head" data-head>
<path class="girl-hair-secondary" data-hair-tip d="M-35-82Q-44-108-6-112 40-117 40-71L39 10Q22 17 22-6L22-24H-24L-25-6-31 12-39 7Z" fill="#302b2b"/>
<g data-front-face>
<ellipse data-ear-left cx="-30" cy="-53" rx="6" ry="9" fill="#daab8e"/><ellipse data-ear-right cx="31" cy="-53" rx="6" ry="9" fill="#daab8e"/>
<path data-face-skin d="M-31-82Q-24-106 2-102 34-103 33-74L31-46Q26-23 0-15-27-23-31-48Z" fill="url(#rig-skin)"/>
<path data-face-hair d="M-34-55Q-45-104-8-113 29-121 42-91L37-53 28-79 24-91Q5-77-22-81L-29-53Z" fill="#352e2b"/>
<path d="M-26-96Q0-113 26-101" fill="none" stroke="#5b4337" stroke-width="2" opacity=".65" stroke-linecap="round"/>
<path d="m27-80 8-3 2 4-8 3Z" fill="#afd3a7"/>
<g class="girl-expression">
<path data-brow-left d="M-23-69Q-15-73-7-69" fill="none" stroke="#5b4134" stroke-width="2" stroke-linecap="round"/><path data-brow-right d="M8-69Q17-73 24-68" fill="none" stroke="#5b4134" stroke-width="2" stroke-linecap="round"/>
<g class="girl-eyes" data-eyes><g data-eye-left><path d="M-24-59Q-16-67-7-59-15-52-24-59" fill="#fff3e5"/><g data-pupil-left><ellipse cx="-15" cy="-59" rx="4" ry="5" fill="#708c71"/><ellipse cx="-15" cy="-59" rx="2" ry="3.8" fill="#20332e"/><circle cx="-14" cy="-60.5" r="1.1" fill="#fff"/></g><path d="M-24-59Q-16-66-7-59" fill="none" stroke="#523b31" stroke-width="1.3" stroke-linecap="round"/></g><g data-eye-right><path d="M8-59Q16-67 25-59 17-52 8-59" fill="#fff3e5"/><g data-pupil-right><ellipse cx="17" cy="-59" rx="4" ry="5" fill="#708c71"/><ellipse cx="17" cy="-59" rx="2" ry="3.8" fill="#20332e"/><circle cx="18" cy="-60.5" r="1.1" fill="#fff"/></g><path d="M8-59Q16-66 25-59" fill="none" stroke="#523b31" stroke-width="1.3" stroke-linecap="round"/></g></g>
<path data-lid-left d="M-24-59q9 4 17 0" fill="none" stroke="#6c4939" stroke-width="1.7" opacity="0"/><path data-lid-right d="M8-59q8 4 17 0" fill="none" stroke="#6c4939" stroke-width="1.7" opacity="0"/>
<path data-nose d="m0-60-2 11 4 1" fill="none" stroke="#bf8e72" stroke-width="1.1" stroke-linecap="round"/>
<ellipse data-cheek-left cx="-23" cy="-44" rx="6" ry="3" fill="#d58d7f" opacity=".23"/><ellipse cx="25" cy="-44" rx="6" ry="3" fill="#d58d7f" opacity=".23"/>
<path data-mouth d="M-7-34Q0-29 8-34" fill="none" stroke="#9b6659" stroke-width="1.8" stroke-linecap="round"/>
<ellipse data-mouth-open cx="1" cy="-33" rx="3.5" ry="2" fill="#945c54" opacity="0"/>
</g></g>

</g>
<g data-desk opacity="0"><path d="m-83 314-9 108m170-108 8 108" stroke="#5a7564" stroke-width="7" stroke-linecap="round"/><path d="M-96 280H90L103 318H-104Z" fill="#b0ad8e"/><path d="M-104 318H103v8H-104Z" fill="#727e64"/><path d="M-96 282H90" stroke="#d3cfad" stroke-width="2"/><ellipse cx="0" cy="304" rx="70" ry="5" fill="#4a6651" opacity=".2"/></g>
<g data-laptop opacity="0"><path d="M-57 281H57L72 304H-73Z" fill="#8baba0" stroke="#4b6e60" stroke-width="1"/><g data-screen><path d="M-52 224H52L57 281H-57Z" fill="#314e46" stroke="#aac8b1" stroke-width="2"/><g data-screen-content><path d="M-44 232H44L48 272H-48Z" fill="#477366"/><path d="m-33 244 21 0m-21 8h46m-46 8h30" stroke="#a8ceae" stroke-width="2" opacity=".8" stroke-linecap="round"/></g></g><path d="m-48 288 95 0m-91 6 88 0" stroke="#456b5b" stroke-width="2" stroke-dasharray="5 3"/><path d="M-14 298H12l3 4h-31Z" fill="#6d9280"/></g>
<g data-book opacity="0"><path d="M-50 279Q-25 271 0 280 25 271 50 279L49 310Q24 304 0 313-25 304-50 310Z" fill="#d9d2af" stroke="#708d70" stroke-width="1.5"/><path d="m0 281 0 30" stroke="#8a9977" stroke-width="1.5"/><path d="m-40 286 28 0m-28 7h27m-27 7h23m29-14h27m-27 7h28m-28 7h23" stroke="#a3ae8b" stroke-width="1.3"/><path data-page d="M0 280Q22 270 48 278L47 307Q23 301 0 312Z" fill="#e9e3c6" stroke="#aab592" stroke-width=".8"/></g>
${forearm('left')}${forearm('right')}
<g data-confusion opacity="0"><path d="M59 125q-2-9 6-9 9 0 8 8-1 5-8 8v4m0 6v1" fill="none" stroke="#a5baaa" stroke-width="2" stroke-linecap="round"/></g>
</g></svg>`.replace(/\b(data-[\w-]+)(?=[\s>])/g,'$1=""');}
