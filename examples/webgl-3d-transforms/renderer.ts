import {ResourceScope,makeProgram,requiredUniform,type Scene} from './gl-utils.js';
import {vertices,multiply,perspective,orthographic,translation,rotationY,type Options} from './data.js';
export const vertexShader=`#version 300 es
layout(location=0) in vec3 aPosition;
layout(location=1) in vec3 aColor;
uniform mat4 uMvp;
out vec3 vColor;
void main(){gl_Position=uMvp*vec4(aPosition,1.0);vColor=aColor;}`;
export const fragmentShader=`#version 300 es
precision highp float;
in vec3 vColor;
out vec4 outColor;
void main(){outColor=vec4(vColor,1.0);}`;
export function createScene(gl:WebGL2RenderingContext,options:Options):Scene {
  const scope=new ResourceScope();
  try {
    const program=makeProgram(gl,scope,vertexShader,fragmentShader);
    const vao=scope.own(gl.createVertexArray(),v=>gl.deleteVertexArray(v));
    const buffer=scope.own(gl.createBuffer(),b=>gl.deleteBuffer(b));
    gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(gl.ARRAY_BUFFER,vertices,gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,24,0);
    gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,24,12);
    const mvp=requiredUniform(gl,program,'uMvp');
    return {draw(width,height,time){
      const aspect=width/height;
      const projection=options.projection==='perspective'?perspective(Math.PI/3,aspect,.1,10):orthographic(-1.3*aspect,1.3*aspect,-1.3,1.3,.1,10);
      const model=rotationY((options.angle+(options.animate?time*.025:0))*Math.PI/180);
      const view=translation(0,0,-options.camera);
      gl.viewport(0,0,width,height);gl.clearColor(.035,.06,.09,1);gl.clearDepth(1);
      gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      options.depth?gl.enable(gl.DEPTH_TEST):gl.disable(gl.DEPTH_TEST);gl.depthFunc(gl.LESS);
      gl.useProgram(program);gl.bindVertexArray(vao);gl.uniformMatrix4fv(mvp,false,multiply(projection,multiply(view,model)));
      gl.drawArrays(gl.TRIANGLES,0,6);
    },dispose(){scope.dispose();}};
  }catch(error){scope.dispose();throw error;}
}
