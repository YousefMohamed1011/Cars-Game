import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, Platform, PanResponder, GestureResponderEvent } from 'react-native';
import { GLView } from 'expo-gl';
import * as THREE from 'three';
import { Renderer } from 'expo-three';

interface CarCanvasProps {
  onSceneReady: (scene: THREE.Scene, camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer) => void;
  onFrame?: (time: number, delta: number) => void;
  enableTouchOrbit?: boolean;
  onOrbitRotate?: (deltaX: number, deltaY: number) => void;
  style?: any;
}

export const CarCanvas: React.FC<CarCanvasProps> = ({
  onSceneReady,
  onFrame,
  enableTouchOrbit = true,
  onOrbitRotate,
  style,
}) => {
  const lastTouchRef = useRef<{ x: number; y: number } | null>(null);
  const animFrameIdRef = useRef<number | null>(null);

  // PanResponder for 360-degree touch rotation around car
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => enableTouchOrbit,
      onMoveShouldSetPanResponder: () => enableTouchOrbit,
      onPanResponderGrant: (evt: GestureResponderEvent) => {
        lastTouchRef.current = {
          x: evt.nativeEvent.pageX,
          y: evt.nativeEvent.pageY,
        };
      },
      onPanResponderMove: (evt: GestureResponderEvent) => {
        if (!lastTouchRef.current || !onOrbitRotate) return;
        const dx = evt.nativeEvent.pageX - lastTouchRef.current.x;
        const dy = evt.nativeEvent.pageY - lastTouchRef.current.y;
        lastTouchRef.current = {
          x: evt.nativeEvent.pageX,
          y: evt.nativeEvent.pageY,
        };
        onOrbitRotate(dx, dy);
      },
      onPanResponderRelease: () => {
        lastTouchRef.current = null;
      },
      onPanResponderTerminate: () => {
        lastTouchRef.current = null;
      },
    })
  ).current;

  // On Web fallback: if running on web platform, handle canvas creation
  const webCanvasRef = useRef<any>(null);

  useEffect(() => {
    if (Platform.OS === 'web' && webCanvasRef.current) {
      const canvas = webCanvasRef.current;
      const width = canvas.clientWidth || window.innerWidth;
      const height = canvas.clientHeight || window.innerHeight;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
      const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
      });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;

      onSceneReady(scene, camera, renderer);

      let lastTime = performance.now();
      const renderLoop = (time: number) => {
        const delta = (time - lastTime) / 1000;
        lastTime = time;

        if (onFrame) {
          onFrame(time / 1000, delta);
        }
        renderer.render(scene, camera);
        animFrameIdRef.current = requestAnimationFrame(renderLoop);
      };
      animFrameIdRef.current = requestAnimationFrame(renderLoop);

      const handleResize = () => {
        if (!canvas) return;
        const newW = canvas.clientWidth || window.innerWidth;
        const newH = canvas.clientHeight || window.innerHeight;
        camera.aspect = newW / newH;
        camera.updateProjectionMatrix();
        renderer.setSize(newW, newH);
      };
      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
        if (animFrameIdRef.current) {
          cancelAnimationFrame(animFrameIdRef.current);
        }
        renderer.dispose();
      };
    }
  }, []);

  const handleContextCreate = async (gl: any) => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      50,
      gl.drawingBufferWidth / gl.drawingBufferHeight,
      0.1,
      1000
    );

    const renderer = new Renderer({ gl });
    renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);
    renderer.setPixelRatio(1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    onSceneReady(scene, camera, renderer as unknown as THREE.WebGLRenderer);

    let lastTime = Date.now();
    const render = () => {
      animFrameIdRef.current = requestAnimationFrame(render);
      const now = Date.now();
      const delta = (now - lastTime) / 1000;
      lastTime = now;

      if (onFrame) {
        onFrame(now / 1000, delta);
      }

      renderer.render(scene, camera);
      gl.endFrameEXP();
    };

    render();
  };

  useEffect(() => {
    return () => {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, []);

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.container, style]} {...panResponder.panHandlers}>
        <canvas
          ref={webCanvasRef}
          style={{
            width: '100%',
            height: '100%',
            display: 'block',
            outline: 'none',
          }}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, style]} {...panResponder.panHandlers}>
      <GLView style={StyleSheet.absoluteFill} onContextCreate={handleContextCreate} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0d14',
  },
});
