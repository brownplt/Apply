"use strict";

function identity(x) { return x; }

function trim(str) {
  return str;
}

function calcEnum(fieldName, data) {
  var elts = Object.create(null);
  data.forEach(function(o) { elts[o[fieldName]] = true; });
  return { type: 'enum', vals: Object.keys(elts) }
}

function calcSet(fieldName, data) {
  var elts = Object.create(null);
  data.forEach(function(o) {
    o[fieldName].forEach(function(f) { elts[f] = true; });
  });
  return { type: 'set', vals: Object.keys(elts) }
}

function disp(visStyle, visible) {
  return visible.liftB(function(b) { return b ? visStyle : 'none'; });
}

function isValidLink(link) {
  return typeof link.url === 'string';
}

function dispVal(val, type) {
  if (type === 'text' || (typeof type === 'object' && type.type === 'enum')) {
    if (typeof val === 'string') {
      return trim(val) === '' ? DIV({ className: 'err' }, 'Missing Value') 
                              : DIV(val);
    }
    else {
      return SPAN({ className: 'err' }, 'Unexpected value');
    }
  }
  else if (type === 'num') {
    if (typeof val === 'number') {
      return DIV({ className: 'num' }, val);
    }
    else if (val === null) {
      return SPAN({ className: 'err' }, 'Missing');
    }
    else {
      return SPAN({ className: 'err' }, 'Unexpected value');
    }
  }
  else if (typeof type === 'object' && type.type === 'set') {
    return DIV({ className: 'set' }, 
               DIV(val.map(function(v) { return dispVal(v, 'text'); })));
  }
  else if (type === 'links') {
    return DIV({ className: 'set' }, val.filter(isValidLink).map(function(v) {
                 return dispVal(v, 'link'); }));
  }
  else if (type === 'link') {
    return DIV(DIV(A({ target: '_blank', href: val.url }, val.text)));
  }
  else {
    debugger;
  }
}

// obj : an object to display
// fields : Array<{ name: Str, visible: Behavior Bool }>
// filter : Behavior<obj -> Bool>
function displayRow(obj, fields, filter) {
  function mkCell(field) {
    return DIV({ className: 'cell',
                 style: { display: disp('table-cell',field.visible) } },
               dispVal(obj[field.name], field.type));
  }
  var dispWhen = disp('table-row', filter.liftB(function(pred) {
    return pred(obj);
  }));
  return DIV({ className: 'row',
               style: { display: dispWhen } },
             fields.map(mkCell));
}

function invCompare(f) {
  return function(x, y) { return -1 * f(x, y); };
}

function headers(fields) {

  function makeCompare(fld) {
    if (fld.type === 'num') {
      return function(o1, o2) { return o1[fld.name] - o2[fld.name]; };
    }
    else if (fld.type === 'text') {
      return function(o1, o2) { console.log('sorting by', fld.name);
        var v1 = o1[fld.name], v2 = o2[fld.name];
        if (v1 < v2) { return -1; }
        else if (v1 > v2) { return 1; }
        else { return 0; }
      };
    }
    else { return null; }
  }

  function h(fld) {
    var toggle = null;
    var cmp = makeCompare(fld);
    if (cmp) {
      toggle = tagRec(['click'], function(clickE) {
        return SPAN({ className: 'buttonLink' },
                   clickE.collectE(true, function(_, b) { return !b; })
                         .mapE(function(b) { return b ? 'ꜛ' : 'ꜜ'; })
                         .startsWith('ꜛ'));
      });
    }


    return {
      elt: DIV({ className: 'cell',
                 style: { display: disp('table-cell', fld.visible) }
               },
              fld.friendly, toggle ? toggle : SPAN()),
      compare: toggle 
                 ? clicksE(toggle)
                     .collectE(true, function(_, b) { return !b; })
                      .mapE(function(b) { return b ? cmp : invCompare(cmp); })
                 : zeroE()
    };
  }

  var heads = fields.map(h);

  return {
    elt: DIV({ className: 'row header' }, heads.map(function(h) { return h.elt; })),
    compare: mergeE.apply(null, heads.map(function(h) { return h.compare; }))
                   .startsWith(function(_, __) { return 0; })
  }
}

function displayTable(objs, fields, filter) {
  var head = headers(fields);

  var rows = liftB(function(objsV, compareV) {
    return objsV.sort(compareV)
                .map(function(o) { return displayRow(o, fields, filter); });
  }, objs, head.compare);

  
  return DIV({ id: 'applicantTable', className: 'table' },
             head.elt, rows);
}

// field : { name: Str, friendly: Str, type: FieldType }
// returns { filter: Behavior (obj -> Bool), elt: HTML }
function makeFilter(field) {
  var input, fn, elt;
  if (field.type === 'text') {
    input = INPUT({ type: 'text', placeholder: field.friendly });
    fn = $B(input).liftB(function(search) {
      return function(obj) {
        if (search === '') { return true; }
        else { return obj[field.name].indexOf(search) !== -1; }
      };
    });
    elt = input;
  }
  else if (field.type === 'num') {
    var min = INPUT({ className: 'inlineInput', type: 'text', placeholder: 'min' });
    var max = INPUT({ type: 'text', placeholder: 'max' });
    fn = liftB(function(minV, maxV) {
      minV = parseFloat(minV);
      maxV = parseFloat(maxV);
      return function(obj) { 
        var passesMin = isNaN(minV) || obj[field.name] >= minV;
        var passesMax = isNaN(maxV) || obj[field.name] <= maxV;
        return passesMin && passesMax;
      };
    }, $B(min), $B(max));
    elt = DIV(field.friendly, ': [', min, ', ', max, ']');

  }
  else if (typeof field.type === 'object' && 
           (field.type.type === 'enum' || field.type.type === 'set')) {
    var opts = field.type.vals.map(function(s) { return OPTION({ value: s }, s); });
    var select = SELECT(opts);
    var input = SPAN(select)
    
    fn = liftB(function(selection) {
      return function(obj) { 
        return field.type.type === 'enum'  
          ? obj[field.name] === selection
          : obj[field.name].indexOf(selection) !== -1;
        };     
    }, $B(select));
    elt = DIV(input,field.friendly, input);
  }
  else {
      debugger;
  }

  return {
    friendly: field.friendly,
    filter: fn,
    elt: elt
  };
}

function filterPicker(filters, isAnd) {
  var ix = 0;
  var sel = SELECT([OPTION({ value: -1 }, '(select filter)')].concat(
    filters.map(function(fld) {
      return OPTION({ value: ix++ }, fld.friendly);
  })));

  var selE = $B(sel).changes();

  var subFilter = selE.mapE(function(ix) { 
    if (ix === '-1') {
      return {
        filter: constantB(function(_) { return !!isAnd; }),
        elt: sel
      }
    }
    else {
      return filters[ix].maker(); } });

  return {
    filter: subFilter.mapE(function(v) { return v.filter; })
                     .startsWith(constantB(function(_) { return !!isAnd; }))
                     .switchB(),
    elt: subFilter.mapE(function(v) { return v.elt; })
                  .startsWith(sel),
    disabled: selE.mapE(function(ix) { return ix === '-1'; }).startsWith(true)
  };
}

function filterAndOr(makeFilter, isAnd) {
  var edit = receiverE();

  var init = [ makeFilter(isAnd) ];
  var arr = edit.collectE(init, function(v, arr) {
    if (v === 'new') {
      return arr.concat([makeFilter(isAnd)]);
    }
    else if (v.delete) {
      arr = arr.filter(function(w) { return w !== v.delete; });
      return arr.length === 0 ? [ makeFilter(isAnd) ] : arr;
    }
    else {
      return arr;
    }
  }).startsWith(init);

  
  var elt = DIV({}, arr.liftB(function(arrV) {  
    var fn = function() { return Array.prototype.slice.call(arguments); };
    var la = [fn].concat(arrV.map(function(v) { 
      var del = A({ href: '#', className: 'buttonLink' }, '⊗');
      $E(del, 'click').mapE(function(_) { edit.sendEvent({ delete: v }); });
      return DIV({ className: 'filterPanel' }, DIV(DIV(del), DIV(v.elt))); }));
    return liftB.apply(null, la);
    return r;
  }).switchB());

  var fn_and = function() {
    var args = Array.prototype.slice.call(arguments);
    return function(obj) {
      if (isAnd) {
        return args.every(function(f) { return f(obj); });
      }
      else {
        return args.some(function(f) { return f(obj); });
      }
    };
  };
  var filter = arr.liftB(function(arr_v) {
    return liftB.apply(null, 
      [fn_and].concat(arr_v.map(function(f) { return f.filter; })));
   }).switchB();


  var disabled = arr.liftB(function(arrV) {
    return arrV[arrV.length - 1].disabled;
  }).switchB();

  disabled.changes().mapE(function(disabledV) {
    if (!disabledV) { edit.sendEvent('new'); } });
  
  return {
    filter: filter,
    elt: DIV({ className: 'filterPanel' }, 
             DIV(DIV(SPAN(isAnd ? 'and' : 'or')), 
                 DIV({ className: 'lbracket' }, elt))),
    disabled: disabled
  };
}

function filterNot(makeFilter) {
  var sub = makeFilter();
  return {
    filter: sub.filter.liftB(function(f) { return function(x) { return !f(x); }; }),
    elt: DIV({ className: 'filterPanel' }, 'not', sub.elt)
  };
}

function filterAnd(makeFilter) {
  return filterAndOr(makeFilter, true);
}

function filterOr(makeFilter) {
  return filterAndOr(makeFilter, false);
}

function makeVis(field) {
  var input = INPUT({ type: 'checkbox', checked: 'checked' });
  return { elt: DIV(input,field.friendly), 
           val: $B(input) }
}


var fields = [
  { name: 'firstName', 
    friendly: 'First Name',
    type: 'text'
  },
  { name: 'lastName', 
    friendly: 'Last Name',
    type: 'text',
  },
  { name: 'email',
    friendly: 'Email',
    type: 'link'
  },
  { name: 'country',
    friendly: 'Citizen',
    type: calcEnum('country', data)
  },
  { name: 'areas',
    friendly: 'Areas',
    type: calcSet('areas', data)
  },
  { name: 'materials',
    friendly: 'Materials',
    type: 'links'
  },
  {
    name: 'recs',
    friendly: 'Recommendations',
    type: 'links'
  },
  {
    name: 'expectedRecCount',
    friendly: 'Recs Excepted',
    type: 'num'
  },
  { name: 'GPA', friendly: 'GPA', type: 'num' },
  { name: 'GREMath', friendly: 'GRE Math', type: 'num' },
  { name: 'GREVerbal', friendly: 'GRE Verbal', type: 'num' }
];

function canFilter(fld) {
  return fld.type !== 'links' && fld.type !== 'link';
}

function instFilter(isAnd) {
  var flds = fields.filter(canFilter).map(function(fld) {
    return { friendly: fld.friendly, 
             maker: function() { return makeFilter(fld); } }; });
  var complex = [
    { friendly: 'and ...',
      maker: function() { return filterAnd(instFilter); } },
    { friendly: 'or ...',
      maker: function() { return filterOr(instFilter); } },
    { friendly: 'not ...',
      maker: function() { return filterNot(instFilter); } }
  ]

  return filterPicker(flds.concat(complex), isAnd);
}

var vises = fields.map(function(f) {
  var r = makeVis(f);
  f.visible = r.val;
  return r.elt;
});

var tableFilter = filterAnd(instFilter); // filterAnd(filters);

var sortedData = constantB(data);

insertDomB(DIV({ id: 'filterPanel' }, tableFilter.elt), 'filterPanel');
insertDomB(DIV({ id: 'visPanel' }, vises), 'vises');
insertDomB(displayTable(sortedData, fields, tableFilter.filter), 'applicantTable');
