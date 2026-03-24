function on(id) {
  if (!id) return;
  var http = new XMLHttpRequest();
  http.onreadystatechange = function() {
    if (http.readyState == 4) {
      const obj = document.getElementById('footer');
      obj.innerHTML = http.responseText;
      obj.name = id;
    }
  }
  http.open('GET', './help.php?id=' + id, true );
  http.send();
}

function off() {
  const obj = document.getElementById('footer');
  obj.innerHTML = inihelp;
  obj.name = '';
}

function flip(id) {
  if (!id) return;
  if (document.getElementById('footer').name == id) {
    off();
  } else {
    on(id);
  }
}

function getcookie(key, def) {
  const cookies = document.cookie.split(';');
  var res = '';
  cookies.forEach((item) => {
    const element = item.split('=');
    if (element[0].trim() == key) res = element[1];
  });
  return(res ? res : def);
}

function setspiner() {
  const pnavi = document.getElementById('pnavi');
  const nup = document.getElementById('naviup');
  const ndn = document.getElementById('navidn');
  const pos = pnavi.value;
  if (pnavi.min == pos) {
    nup.disabled = true;
  } else {
    nup.disabled = false;
  }
  if (pnavi.max == pos) {
    ndn.disabled = true;
  } else {
    ndn.disabled = false;
  }
}

function setdisp(sw) {
  if (sw) {
    document.getElementById('setting').style.display = 'block';
    document.getElementById('setclose').style.display = 'block';
    document.getElementById('setopen').style.display = 'none';
  } else {
    document.getElementById('setting').style.display = 'none';
    document.getElementById('setclose').style.display = 'none';
    document.getElementById('setopen').style.display = 'block';
  }
}

function setting(obj) {
  const sw = document.getElementById('setting').style.display == 'none';
  setdisp(sw);
  if (sw) {
    obj.innerHTML = '△';
    setspiner();
  } else {
    obj.innerHTML = '▽';
    //document.cookie = 'scale=' + getcookie('scale', 1);
  }
}

function resize(scale = 1) {
  document.cookie = 'scale=' + scale;
  document.body.style.fontSize = scale + 'rem';
}

function setnavipos(pos = 0) {
  document.getElementById('main').style.minHeight = 'calc(14.7rem + ' + pos + 'rem)';
}

function navipos(dif, pos = -1) {
  const pnavi = document.getElementById('pnavi');
  const nup = document.getElementById('naviup');
  const ndn = document.getElementById('navidn');
  if (pos < 0) pos = Number(pnavi.value);
  if (dif == -1) { if (pos > pnavi.min) pos -= 1; }
  if (dif == 1) { if (pos < pnavi.max) pos += 1; }
  pnavi.value = pos;
  if (pnavi.min == pos) {
    nup.disabled = true;
  } else {
    nup.disabled = false;
  }
  if (pnavi.max == pos) {
    ndn.disabled = true;
  } else {
    ndn.disabled = false;
  }
  document.cookie = 'navipos=' + pos;
  setnavipos(pos);
}

function waiting(sw = true) {
  const obj = document.getElementById('wait');
   if (sw) {
    obj.style.display = 'block';
  } else {
    obj.style.display = 'none';
  }
}

function init() {
  waiting(false);
  const set = document.getElementById('setting');
  const scale = getcookie('scale');
  resize(scale);
  if (scale && set) setdisp(false);
  const npos = getcookie('navipos', 0);
  if (set) { navipos(0, npos) } else { setnavipos(npos); }
  const foot = document.getElementById('footer');
  const footerHeight = document.querySelector('footer').offsetHeight;
  console.log(footerHeight);
  inihelp = foot.innerHTML;
  if (~inihelp.indexOf('<h3>')) foot.style.minHeight = 'calc(100vh - 27.4rem - ' + npos + 'rem - ' + footerHeight + 'px)';
}