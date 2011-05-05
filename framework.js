
// Framework for brdf rendering - Rodrigo Baravalle
// 2011

var gl;

function initGL(canvas) {
    try {
        gl = canvas.getContext("experimental-webgl");
        gl.viewportWidth = canvas.width;
        gl.viewportHeight = canvas.height;
    } catch (e) {
    }
    if (!gl) {
        alert("Could not initialise WebGL, sorry :-(");
    }
}


function getShader(gl, id) {
    var shaderScript = document.getElementById(id);
    if (!shaderScript) {
        return null;
    }

    var str = "";
    var k = shaderScript.firstChild;
    while (k) {
        if (k.nodeType == 3) {
            str += k.textContent;
        }
        k = k.nextSibling;
    }

    var shader;
    if (shaderScript.type == "x-shader/x-fragment") {
        shader = gl.createShader(gl.FRAGMENT_SHADER);
    } else if (shaderScript.type == "x-shader/x-vertex") {
        shader = gl.createShader(gl.VERTEX_SHADER);
    } else {
        return null;
    }

    gl.shaderSource(shader, str);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        alert(gl.getShaderInfoLog(shader));
        return null;
    }

    return shader;
}


var shaderProgram;

function initShaders() {
    var fragmentShader = getShader(gl, "per-fragment-lighting-fs");
    var vertexShader = getShader(gl, "per-fragment-lighting-vs");

    shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);

    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        alert("Could not initialise shaders");
    }

    gl.useProgram(shaderProgram);

    shaderProgram.vertexPositionAttribute = gl.getAttribLocation(shaderProgram, "aVertexPosition");
    gl.enableVertexAttribArray(shaderProgram.vertexPositionAttribute);

    shaderProgram.vertexNormalAttribute = gl.getAttribLocation(shaderProgram, "aVertexNormal");
    gl.enableVertexAttribArray(shaderProgram.vertexNormalAttribute);

    shaderProgram.textureCoordAttribute = gl.getAttribLocation(shaderProgram, "aTextureCoord");
    gl.enableVertexAttribArray(shaderProgram.textureCoordAttribute);

    shaderProgram.pMatrixUniform = gl.getUniformLocation(shaderProgram, "uPMatrix");
    shaderProgram.mvMatrixUniform = gl.getUniformLocation(shaderProgram, "uMVMatrix");
    shaderProgram.nMatrixUniform = gl.getUniformLocation(shaderProgram, "uNMatrix");
    shaderProgram.samplerUniform = gl.getUniformLocation(shaderProgram, "uSampler");
    shaderProgram.materialShininessUniform = gl.getUniformLocation(shaderProgram, "uMaterialShininess");
    shaderProgram.showSpecularHighlightsUniform = gl.getUniformLocation(shaderProgram, "uShowSpecularHighlights");
    shaderProgram.useTexturesUniform = gl.getUniformLocation(shaderProgram, "uUseTextures");
    shaderProgram.uBrdfUniform = gl.getUniformLocation(shaderProgram, "uBrdf");
    shaderProgram.useLightingUniform = gl.getUniformLocation(shaderProgram, "uUseLighting");
    shaderProgram.ambientColorUniform = gl.getUniformLocation(shaderProgram, "uAmbientColor");
    shaderProgram.pointLightingLocationUniform = gl.getUniformLocation(shaderProgram, "uPointLightingLocation");
    shaderProgram.pointLightingSpecularColorUniform = gl.getUniformLocation(shaderProgram, "uPointLightingSpecularColor");
    shaderProgram.pointLightingDiffuseColorUniform = gl.getUniformLocation(shaderProgram, "uPointLightingDiffuseColor");
}


function handleLoadedTexture(texture) {
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texture.image);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
    gl.generateMipmap(gl.TEXTURE_2D);

    gl.bindTexture(gl.TEXTURE_2D, null);
}


var earthTexture;
var galvanizedTexture;

function initTextures() {
    earthTexture = gl.createTexture();
    earthTexture.image = new Image();
    earthTexture.image.onload = function () {
        handleLoadedTexture(earthTexture)
    }
    earthTexture.image.src = "earth.jpg";

    galvanizedTexture = gl.createTexture();
    galvanizedTexture.image = new Image();
    galvanizedTexture.image.onload = function () {
        handleLoadedTexture(galvanizedTexture)
    }
    galvanizedTexture.image.src = "arroway.de_metal+structure+06_d100_flat.jpg";
}


var mvMatrix = mat4.create();
var mvMatrixStack = [];
var pMatrix = mat4.create();

function mvPushMatrix() {
    var copy = mat4.create();
    mat4.set(mvMatrix, copy);
    mvMatrixStack.push(copy);
}

function mvPopMatrix() {
    if (mvMatrixStack.length == 0) {
        throw "Invalid popMatrix!";
    }
    mvMatrix = mvMatrixStack.pop();
}

function setMatrixUniforms() {
    gl.uniformMatrix4fv(shaderProgram.pMatrixUniform, false, pMatrix);
    gl.uniformMatrix4fv(shaderProgram.mvMatrixUniform, false, mvMatrix);

    var normalMatrix = mat3.create();
    mat4.toInverseMat3(mvMatrix, normalMatrix);
    mat3.transpose(normalMatrix);
    gl.uniformMatrix3fv(shaderProgram.nMatrixUniform, false, normalMatrix);
}

function degToRad(degrees) {
    return degrees * Math.PI / 180;
}


var sceneVertexPositionBuffer;
var sceneVertexNormalBuffer;
var sceneVertexTextureCoordBuffer;
var sceneVertexIndexBuffer;


function handleLoadedScene(sceneData) {
    sceneVertexNormalBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, sceneVertexNormalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sceneData.vertexNormals), gl.STATIC_DRAW);
    sceneVertexNormalBuffer.itemSize = 3;
    sceneVertexNormalBuffer.numItems = sceneData.vertexNormals.length / 3;

    sceneVertexTextureCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, sceneVertexTextureCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sceneData.vertexTextureCoords), gl.STATIC_DRAW);
    sceneVertexTextureCoordBuffer.itemSize = 2;
    sceneVertexTextureCoordBuffer.numItems = sceneData.vertexTextureCoords.length / 2;

    sceneVertexPositionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, sceneVertexPositionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sceneData.vertexPositions), gl.STATIC_DRAW);
    sceneVertexPositionBuffer.itemSize = 3;
    sceneVertexPositionBuffer.numItems = sceneData.vertexPositions.length / 3;


    sceneVertexIndexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sceneVertexIndexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(sceneData.indices), gl.STATIC_DRAW);
    sceneVertexIndexBuffer.itemSize = 1;
    sceneVertexIndexBuffer.numItems = sceneData.indices.length;

    document.getElementById("loadingtext").textContent = "";
}


function loadscene() {
    new Ajax.Request('duck.dae', {
      method: 'get',
      onSuccess: readCOLLADA        
    });
}

function readCOLLADA(xml) {
    var root = xml.responseText;
    var myDiv = Element.extend(document.createElement("div"));
    myDiv.innerHTML = root;
    var geoms = myDiv.getElementsByTagName('geometry');

    // cycle through each geometry
    for(var g = 0; g < geoms.length; g++) {
        var meshes = geoms[g].getElementsByTagName('mesh');

        // cycle through each mesh
        for(var m = 0; m < meshes.length; m++) {
            var triangles = meshes[m].getElementsByTagName('triangles')[0];
            var idVertex; // id object in the xml which contains the normals
            var idNormal; // id object in the xml which contains the normals
            var idTexcoord; // id object in the xml which contains the texcoords
            var idPosition; // id object in the xml which contains the positions
            var normals, positions, texcoords; // strings containing the data
            var cnormals, cpositions, ctexcoords, ctriangs; // count parameters for each type of data
          
            var inputs = triangles.getElementsByTagName('input');
            
            // cycle through each input
            for(var inp = 0; inp < inputs.length; inp++) {
                var iactual = inputs[inp];
                var sourc = iactual.getAttribute('source');
                var semantic = iactual.getAttribute('semantic');

                if(semantic == 'VERTEX') { idVertex = sourc.replace(/#/g, ''); }
                if(semantic == 'NORMAL') { idNormal = sourc.replace(/#/g, ''); }
                if(semantic == 'TEXCOORD') { idTexcoord = sourc.replace(/#/g, ''); }

            }
           
            var vertices = meshes[m].getElementsByTagName('vertices')[0];

            // we are interested in vertex's positions
            // so we search in vertex's attributes looking for positions
            var attr = vertices.getElementsByTagName('input');

            for(var a = 0; a < attr.length; a++) {
                if(attr[a].getAttribute('semantic') == 'POSITION') { 
                    idPosition = attr[a].getAttribute('source').replace(/#/g, '');
                    break;
                }
            }


            var sources = meshes[m].getElementsByTagName('source');

            // cycle through each source
            for(var s = 0; s < sources.length; s++) {
                if(sources[s].getAttribute('id') == idNormal) {
                    var array = sources[s].next();
                    cnormals = array.getAttribute('count');
                    normals = array.innerHTML.split(' ');
                 }
                else if(sources[s].getAttribute('id') == idTexcoord) {
                    var array = sources[s].next();
                    ctexcoords = array.getAttribute('count');
                    texcoords = array.innerHTML.split(' ');
                }
                else if(sources[s].getAttribute('id') == idPosition) {
                    var array = sources[s].next();
                    cpositions = array.getAttribute('count');
                    positions = array.innerHTML.split(' ');
                }
            }
            
            var aNorm = triangles.getElementsByTagName('p')[0];
            var ctriangles = triangles.getAttribute('count');

            //var cant = aNorm.getAttribute('count');
            var triangs = aNorm.innerHTML.split(' ');

            var fpositions, fnormals, ftexcoords, findexs;
            // final variables
            // we loop over vertices defined by (vertex,normal,texcoord) in 'triangs'
            for(var i = 0; i < triangs.length; i+=3) {
                findexs += i/3 + ' ';

                var iposition = triangs[i];
                fpositions += positions[iposition*3] + ' ' 
                            + positions[iposition*3+1] + ' ' 
                            + positions[iposition*3+2] + ' ' ;

                var inormal = triangs[i+1];
                fnormals += normals[inormal*3] + ' ' 
                          + normals[inormal*3+1] + ' ' 
                          + normals[inormal*3+2] + ' ' ;

                var itcoord = triangs[i+2];
                ftexcoords += texcoords[itcoord*2] + ' '
                            + texcoords[itcoord*2+1] + ' ' ;
            }

            var sceneData = {'vertexNormals': fnormals.trim().split(' '),
                             'vertexPositions': fpositions.trim().split(' '),
                             "vertexTextureCoords" : ftexcoords.trim().split(' '),
                             'indices': findexs.trim().split(' ')};

            handleLoadedScene(sceneData);
            
        }
    }
}

var sceneAngle = 180;


function drawScene() {
    gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    if (sceneVertexPositionBuffer == null || sceneVertexNormalBuffer == null || sceneVertexTextureCoordBuffer == null || sceneVertexIndexBuffer == null) {
        return;
    }

    mat4.perspective(45, gl.viewportWidth / gl.viewportHeight, 0.1, 100.0, pMatrix);

    var specularHighlights = document.getElementById("specular").checked;
    gl.uniform1i(shaderProgram.showSpecularHighlightsUniform, specularHighlights);

    var lighting = document.getElementById("lighting").checked;
    gl.uniform1i(shaderProgram.useLightingUniform, lighting);
    if (lighting) {
        gl.uniform3f(
            shaderProgram.ambientColorUniform,
            parseFloat(document.getElementById("ambientR").value),
            parseFloat(document.getElementById("ambientG").value),
            parseFloat(document.getElementById("ambientB").value)
        );

        gl.uniform3f(
            shaderProgram.pointLightingLocationUniform,
            parseFloat(document.getElementById("lightPositionX").value),
            parseFloat(document.getElementById("lightPositionY").value),
            parseFloat(document.getElementById("lightPositionZ").value)
        );

        gl.uniform3f(
            shaderProgram.pointLightingSpecularColorUniform,
            parseFloat(document.getElementById("specularR").value),
            parseFloat(document.getElementById("specularG").value),
            parseFloat(document.getElementById("specularB").value)
        );

        gl.uniform3f(
            shaderProgram.pointLightingDiffuseColorUniform,
            parseFloat(document.getElementById("diffuseR").value),
            parseFloat(document.getElementById("diffuseG").value),
            parseFloat(document.getElementById("diffuseB").value)
        );
    }

    var texture = document.getElementById("texture").value;
    gl.uniform1i(shaderProgram.useTexturesUniform, texture != "none");

    var brdf = $("brdfsel").value;
    gl.uniform1i(shaderProgram.uBrdfUniform, brdf);

    mat4.identity(mvMatrix);

    mat4.translate(mvMatrix, [0, 0, -100]);
    mat4.rotate(mvMatrix, degToRad(23.4), [1, 0, -1]);
    mat4.rotate(mvMatrix, degToRad(sceneAngle), [0, 1, 0]);

    gl.activeTexture(gl.TEXTURE0);
    if (texture == "earth") {
        gl.bindTexture(gl.TEXTURE_2D, earthTexture);
    } else if (texture == "galvanized") {
        gl.bindTexture(gl.TEXTURE_2D, galvanizedTexture);
    }
    gl.uniform1i(shaderProgram.samplerUniform, 0);

    gl.uniform1f(shaderProgram.materialShininessUniform, parseFloat(document.getElementById("shininess").value));

    gl.bindBuffer(gl.ARRAY_BUFFER, sceneVertexPositionBuffer);
    gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, sceneVertexPositionBuffer.itemSize, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, sceneVertexTextureCoordBuffer);
    gl.vertexAttribPointer(shaderProgram.textureCoordAttribute, sceneVertexTextureCoordBuffer.itemSize, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, sceneVertexNormalBuffer);
    gl.vertexAttribPointer(shaderProgram.vertexNormalAttribute, sceneVertexNormalBuffer.itemSize, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sceneVertexIndexBuffer);
    setMatrixUniforms();
    gl.drawElements(gl.TRIANGLES, sceneVertexIndexBuffer.numItems, gl.UNSIGNED_SHORT, 0);
}


var lastTime = 0;

function animate() {
    var timeNow = new Date().getTime();
    if (lastTime != 0) {
        var elapsed = timeNow - lastTime;

        sceneAngle += 0.04 * elapsed;
    }
    lastTime = timeNow;
}


function tick() {
    requestAnimFrame(tick);
    drawScene();
    animate();
}


function webGLStart() {
    var canvas = document.getElementById("lesson14-canvas");
    initGL(canvas);
    initShaders();
    initTextures();
    loadscene();

    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.enable(gl.DEPTH_TEST);

    tick();
}

