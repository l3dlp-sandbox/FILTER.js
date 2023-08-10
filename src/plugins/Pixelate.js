/**
*
* Pixelate: Rectangular, Triangular, Rhomboid, Hexagonal
* @package FILTER.js
*
**/
!function(FILTER, undef) {
"use strict";

var stdMath = Math, hypot = FILTER.Util.Math.hypot,
    sqrt = stdMath.sqrt, abs = stdMath.abs,
    min = stdMath.min, max = stdMath.max,
    floor = stdMath.floor, ceil = stdMath.ceil;

// a simple and fast Pixelate filter for various patterns
// TODO: add some smoothing/dithering in patterns which have diagonal lines separating cells, e.g triangular,..
var PixelateFilter = FILTER.Create({
    name: "PixelateFilter"

    // parameters
    ,scale: 1
    ,pattern: "rectangular"

    ,init: function(scale, pattern) {
        var self = this;
        self.scale = scale || 1;
        self.pattern = pattern || "rectangular";
    }

    // support worker serialize/unserialize interface
    ,path: FILTER.Path

    ,serialize: function() {
        var self = this;
        return {
             scale: self.scale
            ,pattern: self.pattern
        };
    }

    ,unserialize: function(params) {
        var self = this;
        self.scale = params.scale;
        self.pattern = params.pattern;
        return self;
    }

    ,getGLSL: function() {
        return glsl(this);
    }

    ,apply: function(im, w, h) {
        var self = this, pattern = self.pattern, output;
        if (self.scale <= 1  || !pattern || !PIXELATION[pattern]) return im;
        if (self.scale > 100) self.scale = 100;

        output = new FILTER.ImArray(im.length);
        PIXELATION[pattern](self.scale, output, im, w, h);
        return output;
    }
});

// private methods
var PIXELATION = PixelateFilter.PATTERN = {
    "rectangular": function rectangular(scale, output, input, w, h) {
        var imLen = input.length, imArea = imLen>>>2,
            step, step, step_2, stepw, stepw_2,
            bx = w-1, by = imArea-w, p0,
            i, x, yw, sx, sy, syw, pxa, pya, pxc, pyc;

        step = (sqrt(imArea)*scale*1e-2)|0;
        step_2 = (0.5*step)|0; stepw = step*w; stepw_2 = step_2*w;

        x=yw=sx=sy=syw=0;
        for (i=0; i<imLen; i+=4)
        {
            pxa = x-sx; pya = yw-syw;
            pxc = max(0, min(bx, pxa+step_2));
            pyc = max(0, min(by, pya+stepw_2));

            p0 = (pxc + pyc) << 2;

            output[i  ] = input[p0  ];
            output[i+1] = input[p0+1];
            output[i+2] = input[p0+2];
            output[i+3] = input[p0+3];

            // next pixel
            ++x; ++sx;
            if (x >= w)
            {
                sx=0; x=0; ++sy; syw+=w; yw+=w;
                if (sy >= step) {sy=0; syw=0;}
            }
            if (sx >= step) {sx=0;}
        }
    },
    "triangular": function triangular(scale, output, input, w, h) {
        var imLen = input.length, imArea = imLen>>>2,
            step, step_2, step1_3, step2_3, stepw, stepw_2,
            bx = w-1, by = imArea-w, p0,
            i, x, yw, sx, sy, syw, pxa, pya, pxc, pyc;

        step = (sqrt(imArea)*scale*1.25e-2)|0;
        step_2 = (0.5*step)|0; step1_3 = (0.333*step)|0; step2_3 = (0.666*step)|0;
        stepw = step*w; stepw_2 = step_2*w;

        x=yw=sx=sy=syw=0;
        for (i=0; i<imLen; i+=4)
        {
            pxa = x-sx; pya = yw-syw;

            // these edge conditions create the various triangular patterns
            if (sx+sy > step)
            {
                // second (right) triangle
                pxc = max(0, min(bx, pxa+step2_3));
                pyc = max(0, min(by, pya+stepw_2));
                p0 = (pxc + pyc) << 2;
            }
            else
            {
                // first (left) triangle
                pxc = max(0, min(bx, pxa+step1_3));
                pyc = max(0, min(by, pya+stepw_2));
                p0 = (pxc + pyc) << 2;
            }

            output[i  ] = input[p0  ];
            output[i+1] = input[p0+1];
            output[i+2] = input[p0+2];
            output[i+3] = input[p0+3];

            // next pixel
            ++x; ++sx;
            if (x >= w)
            {
                sx=0; x=0; ++sy; syw+=w; yw+=w;
                if (sy >= step) {sy=0; syw=0;}
            }
            if (sx >= step) {sx=0;}
        }
    },
    "rhomboidal": function rhomboidal(scale, output, input, w, h) {
        var imLen = input.length, imArea = imLen>>>2,
            step, step2, stepw, stepw2, odd,
            bx = w-1, by = imArea-w, p0,
            i, x, yw, sx, sy, syw, pxa, pya, pxc, pyc;

        step = (sqrt(imArea)*scale*7e-3)|0;
        step2 = 2*step; stepw = step*w; stepw2 = step2*w;

        x=yw=sx=sy=syw=0; odd = 0;
        for (i=0; i<imLen; i+=4)
        {
            // these edge conditions create the various rhomboid patterns
            if (odd)
            {
                // second row, bottom half of rhombii
                if (sx+sy > step2)
                {
                    // third triangle /\.
                    pxa = min(bx, x-sx+step); pya = yw-syw;
                }
                else if (sx+step-sy > step)
                {
                    // second triangle \/.
                    pxa = x-sx; pya = max(0, yw-syw-stepw);
                }
                else
                {
                    // first triangle /\.
                    pxa = max(0, x-sx-step); pya = yw-syw;
                }
            }
            else
            {
                // first row, top half of rhombii
                if (sx+step-sy > step2)
                {
                    // third triangle \/.
                    pxa = min(bx, x-sx+step); pya = max(0, yw-syw-stepw);
                }
                else if (sx+sy > step)
                {
                    // second triangle /\.
                    pxa = x-sx; pya = yw-syw;
                }
                else
                {
                    // first triangle \/.
                    pxa = max(0, x-sx-step); pya = max(0, yw-syw-stepw);
                }
            }
            pxc = max(0, min(bx, pxa+step));
            pyc = max(0, min(by, pya+stepw));

            p0 = (pxc + pyc) << 2;

            output[i  ] = input[p0  ];
            output[i+1] = input[p0+1];
            output[i+2] = input[p0+2];
            output[i+3] = input[p0+3];

            // next pixel
            ++x; ++sx;
            if (x >= w)
            {
                sx=0; x=0; ++sy; syw+=w; yw+=w;
                if (sy >= step) {sy=0; syw=0; odd = 1-odd;}
            }
            if (sx >= step2) {sx=0;}
        }
    },
    "hexagonal": function hexagonal(scale, output, input, w, h) {
        var imLen = input.length, imArea = imLen>>>2,
            bx = w-1, by = imArea-w, p0, i, x, y, xn, yn,
            t_x, t_y, it_x, it_y, ct_x, ct_y,
            a_x, a_y, b_x, b_y, c_x, c_y,
            A_x, A_y, A_z, B_x, B_y, B_z, C_x, C_y, C_z,
            T_x, T_y, T_z, alen, blen, clen, ch_x, ch_y;

        scale = sqrt(imArea)*scale*1e-2;
        x=y=0;
        for (i=0; i<imLen; i+=4)
        {
            //xn = x/w;
            //yn = y/h;
            t_x = x / scale;
            t_y = y / scale;
            t_y /= 0.866025404;
            t_x -= t_y * 0.5;
            it_x = floor(t_x);
            it_y = floor(t_y);
            ct_x = ceil(t_x);
            ct_y = ceil(t_y);
            if (t_x + t_y - it_x - it_y < 1.0)
            {
                a_x = it_x;
                a_y = it_y;
            }
            else
            {
                a_x = ct_x;
                a_y = ct_y;
            }
            b_x = ct_x;
            b_y = it_y;
            c_x = it_x;
            c_y = ct_y;

            T_x = t_x;
            T_y = t_y;
            T_z = 1.0 - t_x - t_y;
            A_x = a_x;
            A_y = a_y;
            A_z = 1.0 - a_x - a_y;
            B_x = b_x;
            B_y = b_y;
            B_z = 1.0 - b_x - b_y;
            C_x = c_x;
            C_y = c_y;
            C_z = 1.0 - c_x - c_y;

            alen = hypot(T_x - A_x, T_y - A_y, T_z - A_z);
            blen = hypot(T_x - B_x, T_y - B_y, T_z - B_z);
            clen = hypot(T_x - C_x, T_y - C_y, T_z - C_z);
            if (alen < blen)
            {
                if (alen < clen) {ch_x = a_x; ch_y = a_y;}
                else {ch_x = c_x; ch_y = c_y;}
            }
            else
            {
                if (blen < clen) {ch_x = b_x; ch_y = b_y;}
                else {ch_x = c_x; ch_y = c_y;}
            }

            ch_x += ch_y * 0.5;
            ch_y *= 0.866025404;
            ch_x *= scale;
            ch_y *= scale;
            p0 = (max(0, min(bx, ch_x|0)) + max(0, min(by, (ch_y|0)*w))) << 2;
            output[i  ] = input[p0  ];
            output[i+1] = input[p0+1];
            output[i+2] = input[p0+2];
            output[i+3] = input[p0+3];

            // next pixel
            ++x;
            if (x >= w) {x=0; ++y;}
        }
    },
    "rectangular_glsl": [
    'vec2 rectangular(vec2 p, vec2 imgsize, float tilesize) {',
    '    return clamp((tilesize*floor(imgsize * p / tilesize) + 0.5*tilesize)/imgsize, 0.0, 1.0);',
    '}'
    ].join('\n'),
    "triangular_glsl": [
    'vec2 triangular(vec2 p, vec2 imgsize, float tilesize) {',
    '   tilesize *= 1.25;',
    '   vec2 tile = tilesize*floor(imgsize * p / tilesize);',
    '   vec2 t = mod(imgsize * p, tilesize);',
    '   if (t.x+t.y > tilesize) return clamp((tile + vec2(0.66*tilesize, 0.5*tilesize))/imgsize, 0.0, 1.0);',
    '   else return clamp((tile + vec2(0.33*tilesize, 0.5*tilesize))/imgsize, 0.0, 1.0);',
    '}'
    ].join('\n'),
    'rhomboidal_glsl': [
    'vec2 rhomboidal(vec2 p, vec2 imgsize, float tilesize) {',
    '   tilesize *= 0.7;',
    '   vec2 xy = imgsize * p;',
    '   vec2 xyi = floor(xy / tilesize);',
    '   vec2 tile = tilesize*xyi;',
    '   vec2 s = mod(xy, tilesize);',
    '   vec2 a;',
    '   if (0.0 < mod(xyi.y, 2.0)) {',
    '       if (s.x+s.y > 2.0*tilesize) {',
    '           a = vec2(xy.x-s.x+tilesize, xy.y-s.y);',
    '       } else if (s.x+tilesize-s.y > tilesize) {',
    '           a = vec2(xy.x-s.x, xy.y-s.y-tilesize);',
    '       } else {',
    '           a = vec2(xy.x-s.x-tilesize, xy.y-s.y);',
    '       }',
    '   } else {',
    '       if (s.x+tilesize-s.y > 2.0*tilesize) {',
    '           a = vec2(xy.x-s.x+tilesize, xy.y-s.y-tilesize);',
    '       } else if (s.x+s.y > tilesize) {',
    '           a = vec2(xy.x-s.x, xy.y-s.y);',
    '       } else {',
    '           a = vec2(xy.x-s.x-tilesize, xy.y-s.y-tilesize);',
    '       }',
    '   }',
    '   a = vec2(clamp(a.x, 0.0, imgsize.x), clamp(a.y, 0.0, imgsize.y));',
    '   return clamp((a + vec2(tilesize))/imgsize, 0.0, 1.0);',
    '}'
    ].join('\n'),
    "hexagonal_glsl": [
    'vec2 hexagonal(vec2 p, vec2 imgsize, float tilesize) {',
    '    vec2 t = imgsize * p / tilesize;',
    '    t.y /= 0.866025404;',
    '    t.x -= t.y * 0.5;',
    '    vec2 it = vec2(floor(t.x), floor(t.y));',
    '    vec2 ct = vec2(ceil(t.x), ceil(t.y));',
    '    vec2 a;',
    '    if (t.x + t.y - it.x - it.y < 1.0) a = it;',
    '    else a = ct;',
    '    vec2 b = vec2(ct.x, it.y);',
    '    vec2 c = vec2(it.x, ct.y);',
    '    vec3 T = vec3(t.x, t.y, 1.0 - t.x - t.y);',
    '    vec3 A = vec3(a.x, a.y, 1.0 - a.x - a.y);',
    '    vec3 B = vec3(b.x, b.y, 1.0 - b.x - b.y);',
    '    vec3 C = vec3(c.x, c.y, 1.0 - c.x - c.y);',
    '    float alen = length(T - A);',
    '    float blen = length(T - B);',
    '    float clen = length(T - C);',
    '    vec2 ch;',
    '    if (alen < blen) {',
    '        if (alen < clen) ch = a;',
    '        else ch = c;',
    '    } else {',
    '        if (blen < clen) ch = b;',
    '        else ch = c;',
    '    }',
    '    ch.x += ch.y * 0.5;',
    '    ch.y *= 0.866025404;',
    '    ch *= tilesize / imgsize;',
    '    return clamp(ch, 0.0, 1.0);',
    '}'
    ].join('\n')
};
function glsl(filter)
{
    if (filter.scale <= 1 || !filter.pattern || !PIXELATION[filter.pattern]) return {instance: filter, shader: FILTER.Util.GLSL.DEFAULT};
    return {instance: filter, shader: [
    'precision mediump float;',
    'varying vec2 pix;',
    'uniform sampler2D img;',
    'uniform vec2 imgSize;',
    'uniform float tileSize;',
    'uniform int pixelate;',
    PIXELATION['rectangular_glsl'],
    PIXELATION['triangular_glsl'],
    PIXELATION['rhomboidal_glsl'],
    PIXELATION['hexagonal_glsl'],
    'void main(void) {',
        'vec2 p = pix;',
        'if (1 == pixelate) p = triangular(p, imgSize, tileSize);',
        'else if (2 == pixelate) p = rhomboidal(p, imgSize, tileSize);',
        'else if (3 == pixelate) p = hexagonal(p, imgSize, tileSize);',
        'else p = rectangular(p, imgSize, tileSize);',
        'gl_FragColor = texture2D(img, p);',
    '}'
    ].join('\n'),
    vars: function(gl, w, h, program) {
        gl.uniform2f(program.uniform.imgSize,
            w, h
        );
        gl.uniform1f(program.uniform.tileSize,
            sqrt(w*h)*(filter.scale||1)*1e-2
        );
        gl.uniform1i(program.uniform.pixelate,
            'triangular' === filter.pattern ? 1 : (
            'rhomboidal' === filter.pattern ? 2 : (
            'hexagonal' === filter.pattern ? 3 : 0
            )
            )
        );
    }
    };
}
}(FILTER);