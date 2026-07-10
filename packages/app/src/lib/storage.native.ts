import AsyncStorage from '@react-native-async-storage/async-storage';
import type { KV } from './storage';

export const storage: KV = {
  get: (key) => AsyncStorage.getItem(key),
  set: (key, value) => AsyncStorage.setItem(key, value),
  remove: (key) => AsyncStorage.removeItem(key),
};
