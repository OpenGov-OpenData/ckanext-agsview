var date_fields = [];
(function(ckan, jQuery) {

  /* Returns a Leaflet map to use on the different spatial widgets
   *
   * All Leaflet based maps should use this constructor to provide consistent
   * look and feel and avoid duplication.
   *
   * container               - HTML element or id of the map container
   * mapConfig               - (Optional) CKAN config related to the base map.
   *                           These are defined in the config ini file (eg
   *                           map type, API keys if necessary, etc).
   * leafletMapOptions       - (Optional) Options to pass to the Leaflet Map constructor
   * leafletBaseLayerOptions - (Optional) Options to pass to the Leaflet TileLayer constructor
   *
   * Examples
   *
   *   // Will return a map with attribution control
   *   var map = ckan.commonLeafletMap('map', mapConfig);
   *
   *   // For smaller maps where the attribution is shown outside the map, pass
   *   // the following option:
   *   var map = ckan.commonLeafletMap('map', mapConfig, {attributionControl: false});
   *
   * Returns a Leaflet map object.
   */
  var basemaps = [
    'Streets', 'Topographic', 'Oceans', 'OceansLabels', 'NationalGeographic', 'Gray', 'GrayLabels', 'DarkGray', 'DarkGrayLabels', 'Imagery', 'ImageryLabels', 'ImageryTransportation', 'ShadedRelief', 'ShadedReliefLabels', 'Terrain', 'TerrainLabels', 'USATopo',
  ];
  function checkBasemap(url) {
    return url.indexOf('{x}') > -1 && url.indexOf('{y}') > -1 && url.indexOf('{z}') > -1
  }
  ckan.agsCreatemap = function(container, config) {
    var isHttps = window.location.href.substring(0, 5).toLowerCase() === 'https';
    var mapConfig = {
      type: 'stamen'
    };
    if (config.basemap && typeof config.basemap === 'string' && checkBasemap(config.basemap)) {
      mapConfig = {
        type: 'custom',
        url: config.basemap
      }
    }

    var leafletBaseLayerOptions = {
      maxZoom: 18,
      keyboard: true,
      keyboardPanDelta: 100
    };

    map = new L.Map(container, leafletBaseLayerOptions);
    if (typeof config.basemap === 'string' && basemaps.indexOf(config.basemap) > -1) {
      var esriLayer = new L.esri.BasemapLayer(config.basemap);
      map.addLayer(esriLayer);
    } else {
      if (mapConfig.type == 'custom') {
        // Custom XYZ layer
        baseLayerUrl = mapConfig.url;
      } else {
        // Default to Stamen base map
        baseLayerUrl = 'https://stamen-tiles-{s}.a.ssl.fastly.net/terrain/{z}/{x}/{y}.png';
        leafletBaseLayerOptions.subdomains = mapConfig.subdomains || 'abcd';
        leafletBaseLayerOptions.attribution = mapConfig.attribution || 'Map tiles by <a href="http://stamen.com">Stamen Design</a> (<a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a>). Data by <a href="http://openstreetmap.org">OpenStreetMap</a> (<a href="http://creativecommons.org/licenses/by-sa/3.0">CC BY SA</a>)';
      }
      var baseLayer = new L.TileLayer(baseLayerUrl, leafletBaseLayerOptions);
      map.addLayer(baseLayer);
    }

    // Make popup content focusable and trap focus inside popup until closed
    var escapeKeyHandler;
    var focusTrapKeydownHandler;
    var focusTrapFocusinHandler;
    map.on('popupopen', function(e) {
      var popup = e.popup;
      if (popup && popup.getElement) {
        var container = popup.getElement();
        if (container) {
          container.setAttribute('tabindex', '-1');
          // Make content focusable so VoiceOver reads the text
          var contentNode = container.querySelector && container.querySelector('.leaflet-popup-content');
          var focusTarget = container;
          if (contentNode) {
            contentNode.setAttribute('tabindex', '0');
            focusTarget = contentNode;
          }
          setTimeout(function() {
            focusTarget.focus();
          }, 0);

          // Keep focus inside popup: wrap Tab on last element and Shift+Tab on first
          focusTrapKeydownHandler = function(ev) {
            if (ev.keyCode !== 9 || !map._popup || !map._popup.getElement) return;
            var c = map._popup.getElement();
            var content = c.querySelector && c.querySelector('.leaflet-popup-content');
            var closeBtn = c.querySelector && c.querySelector('.leaflet-popup-close-button');
            var first = content || closeBtn;
            var last = closeBtn || content;
            if (!first || !last) return;
            var active = document.activeElement;
            if (!c.contains(active)) return;
            if (ev.shiftKey) {
              if (active === first) {
                ev.preventDefault();
                last.focus();
              }
            } else {
              if (active === last) {
                ev.preventDefault();
                first.focus();
              }
            }
          };
          document.addEventListener('keydown', focusTrapKeydownHandler);

          // If focus leaves the popup (e.g. click outside), move it back
          focusTrapFocusinHandler = function(ev) {
            if (!map._popup || !map._popup.getElement) return;
            var c = map._popup.getElement();
            if (c.contains(ev.target)) return;
            var first = c.querySelector && c.querySelector('.leaflet-popup-content');
            if (first) {
              setTimeout(function() { first.focus(); }, 0);
            }
          };
          document.addEventListener('focusin', focusTrapFocusinHandler);
        }
      }
      // Close popup on Escape
      escapeKeyHandler = function(ev) {
        if (ev.keyCode === 27 && map._popup && map._popup.options.closeOnEscapeKey !== false) {
          map.closePopup();
          ev.preventDefault();
          ev.stopPropagation();
        }
      };
      document.addEventListener('keydown', escapeKeyHandler);
    });
    map.on('popupclose', function(e) {
      if (escapeKeyHandler) {
        document.removeEventListener('keydown', escapeKeyHandler);
        escapeKeyHandler = null;
      }
      if (focusTrapKeydownHandler) {
        document.removeEventListener('keydown', focusTrapKeydownHandler);
        focusTrapKeydownHandler = null;
      }
      if (focusTrapFocusinHandler) {
        document.removeEventListener('focusin', focusTrapFocusinHandler);
        focusTrapFocusinHandler = null;
      }
      // Return focus to the marker (or other source) that opened the popup
      var source = e.popup && e.popup._source;
      if (source && source._icon && typeof source._icon.focus === 'function') {
        try {
          source._icon.focus();
        } catch (err) { /* ignore if focus fails */ }
      }
    });
    return map;
  }

  function singleFeature(item) {
    var properties = item.properties;
    var keys = Object.keys(properties);
    return '<div>' + keys.map(function(key) {
      var value = properties[key];
      if (date_fields.indexOf(key) > -1) {
        date_value = new Date(value);
        value = date_value.toLocaleString(undefined, {
          year: 'numeric',
          month: 'numeric',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          timeZoneName: 'short'
        });
      }
      return '<span><strong>' + key + ':</strong> ' + value + '</span>';
    }).join('<br/>') + '</div>';
  }

  ckan.singleFeature = singleFeature;

  function manyFeatures(featureCollection) {
    return '<div>' + featureCollection.features.map(function(item, i) {
      return '<div><strong>Feature: ' + (i + 1) + '</strong><div>' + singleFeature(item) + '</div></div><br/>';
    }).join("") + '</div>';
  }

  ckan.commonDynamicLayerInfo = function(layer) {
    layer.bindPopup(function(err, featureCollection) {
      if (err || !featureCollection || !featureCollection.features || !featureCollection.features.length) {
        return false;
      }
      if (featureCollection.features.length === 1) {
        return singleFeature(featureCollection.features[0])
      }
      return manyFeatures(featureCollection);
    }, {
      maxHeight: 200
    });
  };

  ckan.commonTiledLayerInfo = function(layer) {
    layer.bindPopup('<span></span>', {
      maxHeight: 200
    });
    layer.on('click', function(e) {
      layer.setPopupContent('<span>loading</span>');
      layer.identify().at(e.latlng).run(function(err, featureCollection) {
        if (err) {
          layer.setPopupContent('<span><strong>Error</strong>: ' + err && err.toString() + '</span>');
          return;
        }
        if (!featureCollection || !featureCollection.features || !featureCollection.features.length) {
          layer.setPopupContent('<span>No features found</span>');
          return;
        }
        if (featureCollection.features.length === 1) {
          layer.setPopupContent(singleFeature(featureCollection.features[0]));
          return;
        }
        return layer.setPopupContent(manyFeatures(featureCollection));
      });
    })
  };
})(this.ckan, this.jQuery);
