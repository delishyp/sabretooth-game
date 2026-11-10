/**
 * Saga's premade motives. motive is author context for the online and local prompt only.
 * aside is one spoken line. gossip is loaded and not spoken yet.
 */
(function (root, factory) {
  const api = factory(load());
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Motives = api;
  function load() {
    if (typeof require === 'function') {
      try { return require('../data/events/motives-v1.json'); } catch (e) { /* browser loads it below */ }
    }
    if (typeof XMLHttpRequest !== 'undefined') {
      try {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', 'data/events/motives-v1.json', false);
        xhr.send();
        if (xhr.status === 200 || xhr.status === 0) return JSON.parse(xhr.responseText);
      } catch (e) { /* no motives file */ }
    }
    return {};
  }
})(typeof self !== 'undefined' ? self : this, function (data) {
  function row(id) {
    const item = data && data[id];
    return item && typeof item === 'object' ? item : null;
  }
  function fillName(text, name) {
    return String(text || '').split('{name}').join(name || '');
  }
  function motive(id) {
    const item = row(id);
    return item && typeof item.motive === 'string' ? item.motive : null;
  }
  function asideLine(id, name) {
    const item = row(id);
    return item && typeof item.aside === 'string' ? fillName(item.aside, name) : null;
  }
  function gossipLine(id, name) {
    const item = row(id);
    return item && typeof item.gossip === 'string' ? fillName(item.gossip, name) : null;
  }
  return { motive, asideLine, gossipLine, slots: () => Object.keys(data || {}).filter((key) => key.charAt(0) !== '_') };
});
