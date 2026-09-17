import { registerRootComponent } from 'expo';

// Safely catch DOM reconciliation NotFoundError caused by React 19 + React Native Web text node mutations
if (typeof window !== "undefined" && typeof Node !== "undefined") {
  const originalRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function <T extends Node>(child: T): T {
    try {
      return originalRemoveChild.call(this, child) as T;
    } catch (error: any) {
      if (error instanceof DOMException && error.name === "NotFoundError") {
        return child;
      }
      throw error;
    }
  };

  const originalInsertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function <T extends Node>(newNode: T, referenceNode: Node | null): T {
    try {
      return originalInsertBefore.call(this, newNode, referenceNode) as T;
    } catch (error: any) {
      if (error instanceof DOMException && error.name === "NotFoundError") {
        return this.appendChild(newNode) as T;
      }
      throw error;
    }
  };
}

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
