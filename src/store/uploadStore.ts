import { create } from 'zustand';
import { FileItem, SoNoValidStatus } from '@/types';

interface UploadStore {
  files: FileItem[];
  confirm_token: string | null;
  addFiles: (files: File[]) => void;
  updateFileStatus: (id: string, status: FileItem['status'], data?: Partial<Pick<FileItem, 'hbl_no' | 'file_url' | 'progress' | 'error_msg'>>) => void;
  updateFileSoNo: (id: string, so_no: string) => void;
  updateFileSoNoValid: (id: string, so_no_valid: SoNoValidStatus) => void;
  removeFile: (id: string) => void;
  clearFiles: () => void;
  setConfirmToken: (token: string) => void;
  reset: () => void;
}

export const useUploadStore = create<UploadStore>((set) => ({
  files: [],
  confirm_token: null,

  addFiles: (files) => {
    const newItems: FileItem[] = files.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      file,
      file_name: file.name,
      file_size: file.size,
      so_no: '',
      so_no_valid: 'empty',
      status: 'pending',
    }));
    set((state) => ({ files: [...state.files, ...newItems] }));
  },

  updateFileStatus: (id, status, data) => {
    set((state) => ({
      files: state.files.map((file) =>
        file.id === id ? { ...file, status, ...data } : file
      ),
    }));
  },

  updateFileSoNo: (id, so_no) => {
    set((state) => ({
      files: state.files.map((file) =>
        file.id === id ? { ...file, so_no } : file
      ),
    }));
  },

  updateFileSoNoValid: (id, so_no_valid) => {
    set((state) => ({
      files: state.files.map((file) =>
        file.id === id ? { ...file, so_no_valid } : file
      ),
    }));
  },

  removeFile: (id) => {
    set((state) => ({ files: state.files.filter((file) => file.id !== id) }));
  },

  clearFiles: () => {
    set({ files: [] });
  },

  setConfirmToken: (token) => {
    set({ confirm_token: token });
  },

  reset: () => {
    set({ files: [], confirm_token: null });
  },
}));