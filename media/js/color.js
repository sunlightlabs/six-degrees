function byte2hex (n) {
    var nybHexString = "0123456789ABCDEF";
    return String(nybHexString.substr((n >> 4) & 0x0F,1)) + nybHexString.substr(n & 0x0F,1);
}
function rgb2hex (r,g,b) {
    return '#' + byte2hex(r) + byte2hex(g) + byte2hex(b);
}
var pastel_hue = function (n,phase) { 
    return Math.sin(0.8979777 * n + phase) * 45 + 205; 
};
var deep_hue = function (n, phase) {
    return Math.sin(0.8979777 * n + phase) * 95 + 155;
};
var black_hue = function (n, phase) {
    return 0;
};
var deep_color = function (n) {
    return [deep_hue(n, 0 + n), 
            deep_hue(n, 2 + n),
            deep_hue(n, 4 + n)]
};

var color = function (n, hue_func) { 
    return rgb2hex(hue_func(n, 0 + n), 
                   hue_func(n, 2 + n), 
                   hue_func(n, 4 + n)); 
};
var set_color = function (n, hue_func, setf) {
    var r = hue_func(n, 0 + n),
        g = hue_func(n, 2 + n),
        b = hue_func(n, 4 + n);
    setf(r, g, b);
    var hex = rgb2hex(r, g, b);
    return hex;
};

var generate_colors = function (n, hue_func, alpha) {
    var colors = [];
    for (var idx = 0; idx < n; idx++) {
        colors.push([hue_func(idx, 0 + idx),
                     hue_func(idx, 2 + idx),
                     hue_func(idx, 4 + idx),
                     alpha]);
    }
    return colors;
};
