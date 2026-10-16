// Classic (non-module) script: shows a hint when index.html is opened by double-clicking (file://),
// because browsers block ES modules there.
if (location.protocol === 'file:') {
  document.addEventListener('DOMContentLoaded', function () {
    var main = document.getElementById('main');
    if (!main) return;
    main.textContent = '';
    var box = document.createElement('div'); box.className = 'card error-state';
    var h = document.createElement('h2'); h.textContent = 'Open this app through a local server';
    var p = document.createElement('p');
    p.textContent = 'Browsers block JavaScript modules when a file is opened by double-clicking it. In VS Code, right-click index.html and choose "Open with Live Server" (see README.md).';
    box.append(h, p); main.append(box);
  });
}
