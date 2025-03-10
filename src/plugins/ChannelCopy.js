/**
*
* Channel Copy
* @package FILTER.js
*
**/
!function(FILTER) {
"use strict";

var stdMath = Math, Min = stdMath.min, Floor = stdMath.floor,
    GLSL = FILTER.Util.GLSL,
    CHANNEL = FILTER.CHANNEL, MODE = FILTER.MODE;

// a plugin to copy a channel of an image to a channel of another image
var ChannelCopyFilter = FILTER.Create({
    name: "ChannelCopyFilter"

    // parameters
    ,srcChannel: CHANNEL.R
    ,dstChannel: CHANNEL.R
    ,centerX: 0
    ,centerY: 0
    ,color: 0
    ,hasInputs: true

    // support worker serialize/unserialize interface
    ,path: FILTER.Path

    // constructor
    ,init: function(srcChannel, dstChannel, centerX, centerY, color) {
        var self = this;
        self.srcChannel = srcChannel || CHANNEL.R;
        self.dstChannel = dstChannel || CHANNEL.R;
        self.centerX = centerX || 0;
        self.centerY = centerY || 0;
        self.color = color || 0;
    }

    ,dispose: function() {
        var self = this;
        self.srcChannel = null;
        self.dstChannel = null;
        self.centerX = null;
        self.centerY = null;
        self.color = null;
        self.$super('dispose');
        return self;
    }

    ,serialize: function() {
        var self = this;
        return {
             srcChannel: self.srcChannel
            ,dstChannel: self.dstChannel
            ,centerX: self.centerX
            ,centerY: self.centerY
            ,color: self.color
        };
    }

    ,unserialize: function(params) {
        var self = this;
        self.srcChannel = params.srcChannel;
        self.dstChannel = params.dstChannel;
        self.centerX = params.centerX;
        self.centerY = params.centerY;
        self.color = params.color;
        return self;
    }

    ,getGLSL: function() {
        return glsl(this);
    }

    // this is the filter actual apply method routine
    ,apply: function(im, w, h) {
        var self = this, Src;
        Src = self.input("source"); if (!Src) return im;

        var src = Src[0], w2 = Src[1], h2 = Src[2],
            i, l = im.length, l2 = src.length,
            sC = self.srcChannel, tC = self.dstChannel,
            x, x2, y, y2, off, xc, yc,
            cX = self.centerX||0, cY = self.centerY||0, cX2 = w2>>>1, cY2 = h2>>>1,
            wm = Min(w,w2), hm = Min(h, h2),
            color = self.color||0, r, g, b, a,
            mode = self.mode, COLOR32 = MODE.COLOR32, COLOR8 = MODE.COLOR8,
            MASK32 = MODE.COLORMASK32, MASK8 = MODE.COLORMASK8;

        if (COLOR32 === mode || MASK32 === mode)
        {
            a = (color >>> 24)&255;
            r = (color >>> 16)&255;
            g = (color >>> 8)&255;
            b = (color)&255;
        }
        else if (COLOR8 === mode || MASK8 === mode)
        {
            color &= 255;
        }

        // make center relative
        cX = Floor(cX*(w-1)) - cX2;
        cY = Floor(cY*(h-1)) - cY2;

        for (x=0,y=0,i=0; i<l; i+=4,++x)
        {
            if (x>=w) {x=0; ++y;}

            xc = x - cX; yc = y - cY;
            if (xc<0 || xc>=w2 || yc<0 || yc>=h2)
            {
                if (COLOR32 === mode) {im[i  ] = r; im[i+1] = g; im[i+2] = b; im[i+3] = a;}
                else if (MASK32 === mode) {im[i  ] = r & im[i  ]; im[i+1] = g & im[i+1]; im[i+2] = b & im[i+2]; im[i+3] = a & im[i+3];}
                else if (COLOR8 === mode) im[i+tC] = color;
                else if (MASK8 === mode) im[i+tC] = color & im[i+sC];
                // else ignore
            }
            else
            {
                // copy channel
                off = (xc + yc*w2)<<2;
                im[i + tC] = src[off + sC];
            }
        }
        // return the new image data
        return im;
    }
});

function glsl(filter)
{
    if (!filter.input("source")) return (new GLSL.Filter(filter)).begin().shader(GLSL.DEFAULT).end().code();
    var glslcode = (new GLSL.Filter(filter))
    .begin()
    .shader([
    'varying vec2 pix;',
    'uniform sampler2D img;',
    'uniform sampler2D src;',
    'uniform vec2 srcSize;',
    'uniform vec2 center;',
    'uniform vec4 color;',
    'uniform int sC;',
    'uniform int tC;',
    '#define COLOR32 '+MODE.COLOR32+'',
    '#define COLOR8 '+MODE.COLOR8+'',
    '#define MASK32 '+MODE.COLORMASK32+'',
    '#define MASK8 '+MODE.COLORMASK8+'',
    '#define RED '+CHANNEL.R+'',
    '#define GREEN '+CHANNEL.G+'',
    '#define BLUE '+CHANNEL.B+'',
    '#define ALPHA '+CHANNEL.A+'',
    'uniform int mode;',
    'float get_channel(vec4 col, int channel) {',
    '   if (ALPHA == channel) return col.a;',
    '   if (BLUE == channel) return col.b;',
    '   if (GREEN == channel) return col.g;',
    '   if (RED == channel) return col.r;',
    '   return 0.0;',
    '}',
    'vec4 set_channel(vec4 col, float val, int channel) {',
    '   vec4 ret = vec4(col.r, col.g, col.b, col.a);',
    '   if (ALPHA == channel) ret.a = val;',
    '   else if (BLUE == channel) ret.b = val;',
    '   else if (GREEN == channel) ret.g = val;',
    '   else if (RED == channel) ret.r = val;',
    '   return ret;',
    '}',
    'void main(void) {',
    '   vec4 tCol = texture2D(img, pix);',
    '   vec2 p = (pix - (center - 0.5*srcSize))/srcSize;',
    '   if (0.0 > p.x || 1.0 < p.x || 0.0 > p.y || 1.0 < p.y) {',
    '       if (MASK32 == mode) {tCol *= color;}',
    '       else if (COLOR32 == mode) {tCol = color;}',
    '       else if (MASK8 == mode) {',
    '           if (ALPHA == tC) tCol.a *= color.a;',
    '           else if (BLUE == tC) tCol.b *= color.b;',
    '           else if (GREEN == tC) tCol.g *= color.g;',
    '           else tCol.r *= color.r;',
    '       }',
    '       else if (COLOR8 == mode) {',
    '           if (ALPHA == tC) tCol.a = color.a;',
    '           else if (BLUE == tC) tCol.b = color.b;',
    '           else if (GREEN == tC) tCol.g = color.g;',
    '           else tCol.r = color.r;',
    '       }',
    '   } else {',
    '       vec4 sCol = texture2D(src, p);',
    '       tCol = set_channel(tCol, get_channel(sCol, sC), tC);',
    '   }',
    '   gl_FragColor = tCol;',
    '}'
    ].join('\n'))
    .input('src', function(filter) {
        var src = filter.input("source");
        return {data:src[0], width:src[1], height:src[2]};
    })
    .input('srcSize', function(filter, w, h) {
        var src = filter.input("source");
        return [src[1]/w, src[2]/h];
    })
    .input('center', function(filter) {
        return [filter.centerX, filter.centerY];
    })
    .input('sC', function(filter) {
        return filter.srcChannel;
    })
    .input('tC', function(filter) {
        return filter.dstChannel;
    })
    .input('color', function(filter) {
        var color = filter.color||0;
        if (MODE.COLOR8 === filter.mode || MODE.MASK8 === filter.mode)
        {
            color = (color & 255)/255;
            return [
            color,
            color,
            color,
            color
            ];
        }
        else
        {
            return [
            ((color >>> 16) & 255)/255,
            ((color >>> 8) & 255)/255,
            (color & 255)/255,
            ((color >>> 24) & 255)/255
            ];
        }
    })
    .end();
    return glslcode.code();
}
}(FILTER);