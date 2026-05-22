import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type LanguageCode = 'es' | 'en';

interface LanguageContextType {
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  t: (key: string) => string;
}

const translations: Record<LanguageCode, Record<string, any>> = {
  es: {
    search: {
      placeholder: 'Buscar...'
    },
    sidebar: {
      board: 'Tablero',
      tasks: 'Tareas',
      calendar: 'Calendario',
      messages: 'Mensajes',
      comments: 'Comentarios',
      team: 'Team',
      reports: 'Reportes',
      stats: 'Estadísticas',
      myProfile: 'Mi Perfil',
      help: 'Ayuda',
      settings: 'Configuración',
      logout: 'Salir'
    },
    settings: {
      header: 'Configuración',
      description: '',
      updateProfile: 'Actualizar perfil',
      quickSettings: 'Ajustes rápidos',
      tabs: {
        profile: 'Perfil',
        appearance: 'Apariencia',
        notifications: 'Notificaciones',
        security: 'Seguridad',
        data: 'Datos'
      },
      accountInfo: 'Información de la cuenta',
      editProfile: 'Editar perfil',
      name: 'Nombre',
      email: 'Correo electrónico',
      userId: 'ID de usuario',
      theme: 'Tema',
      darkMode: 'Modo oscuro',
      lightMode: 'Modo claro',
      primaryColor: 'Color primario',
      fontSize: 'Tamaño de fuente (px)',
      language: 'Idioma',
      savePreferences: 'Guardar preferencias',
      notificationPreferences: 'Preferencias de notificaciones',
      pushNotifications: 'Notificaciones push',
      notificationsDescription: 'Recibir alertas cuando se te asignen tareas, cuando alguien comente o cuando se acerque la fecha de vencimiento.',
      changePassword: 'Cambiar contraseña',
      currentPassword: 'Contraseña actual',
      newPassword: 'Nueva contraseña',
      confirmPassword: 'Confirmar nueva contraseña',
      updatePassword: 'Actualizar contraseña',
      securityOptions: 'Opciones de seguridad',
      deleteAccount: 'Eliminar cuenta',
      deleteAccountWarning: 'Esta acción eliminará permanentemente todos tus proyectos, tareas y datos.',
      dataManagement: 'Gestión de datos',
      exportTasks: 'Exportar tareas (CSV)',
      importTasks: 'Importar tareas',
      exportDescription: 'Exporta tus tareas en CSV o importa backups desde otro archivo. La importación estará disponible en breve.',
      deleteData: 'Eliminar datos',
      deleteDataDescription: 'Si deseas borrar tus datos sin eliminar la cuenta, usa la opción de respaldo y limpieza desde tu perfil.',
      deleteDialogTitle: '¿Eliminar cuenta permanentemente?',
      deleteDialogWarning: 'Esta acción no se puede deshacer. Todos tus proyectos, tareas y datos serán eliminados.',
      cancel: 'Cancelar',
      delete: 'Eliminar'
    },
    messages: {
      preferencesSaved: 'Preferencias guardadas',
      nameUpdated: 'Nombre actualizado',
      passwordMismatch: 'Las contraseñas no coinciden',
      passwordLength: 'La contraseña debe tener al menos 6 caracteres',
      passwordUpdated: 'Contraseña actualizada. Vuelve a iniciar sesión.',
      exportComingSoon: 'Funcionalidad de exportación próximamente'
    }
  },
  en: {
    search: {
      placeholder: 'Search...'
    },
    sidebar: {
      board: 'Board',
      tasks: 'Tasks',
      calendar: 'Calendar',
      messages: 'Messages',
      comments: 'Comments',
      team: 'Team',
      reports: 'Reports',
      stats: 'Statistics',
      myProfile: 'My Profile',
      help: 'Help',
      settings: 'Settings',
      logout: 'Logout'
    },
    settings: {
      header: 'Settings',
      description: 'Customize your account, security and appearance in Task Core with fast, modern and secure options.',
      updateProfile: 'Update profile',
      quickSettings: 'Quick settings',
      tabs: {
        profile: 'Profile',
        appearance: 'Appearance',
        notifications: 'Notifications',
        security: 'Security',
        data: 'Data'
      },
      accountInfo: 'Account information',
      editProfile: 'Edit profile',
      name: 'Name',
      email: 'Email',
      userId: 'User ID',
      theme: 'Theme',
      darkMode: 'Dark mode',
      lightMode: 'Light mode',
      primaryColor: 'Primary color',
      fontSize: 'Font size (px)',
      language: 'Language',
      savePreferences: 'Save preferences',
      notificationPreferences: 'Notification preferences',
      pushNotifications: 'Push notifications',
      notificationsDescription: 'Receive alerts when tasks are assigned to you, when someone comments, or when due dates approach.',
      changePassword: 'Change password',
      currentPassword: 'Current password',
      newPassword: 'New password',
      confirmPassword: 'Confirm new password',
      updatePassword: 'Update password',
      securityOptions: 'Security options',
      deleteAccount: 'Delete account',
      deleteAccountWarning: 'This will permanently delete all your projects, tasks and data.',
      dataManagement: 'Data management',
      exportTasks: 'Export tasks (CSV)',
      importTasks: 'Import tasks',
      exportDescription: 'Export your tasks to CSV or import backups from another file. Import will be available soon.',
      deleteData: 'Delete data',
      deleteDataDescription: 'If you want to clear your data without deleting your account, use backup and cleanup from your profile.',
      deleteDialogTitle: 'Delete account permanently?',
      deleteDialogWarning: 'This action cannot be undone. All your projects, tasks and data will be deleted.',
      cancel: 'Cancel',
      delete: 'Delete'
    },
    messages: {
      preferencesSaved: 'Preferences saved',
      nameUpdated: 'Name updated',
      passwordMismatch: 'Passwords do not match',
      passwordLength: 'Password must be at least 6 characters',
      passwordUpdated: 'Password updated. Please sign in again.',
      exportComingSoon: 'Export functionality coming soon'
    }
  }
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguageState] = useState<LanguageCode>('es');

  useEffect(() => {
    const savedLanguage = localStorage.getItem('taskcore-language') as LanguageCode | null;
    if (savedLanguage === 'es' || savedLanguage === 'en') {
      setLanguageState(savedLanguage);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('taskcore-language', language);
  }, [language]);

  const setLanguage = (lang: LanguageCode) => {
    if (lang === 'es' || lang === 'en') {
      setLanguageState(lang);
    }
  };

  const t = (key: string) => {
    const path = key.split('.');
    let result: any = translations[language];

    for (const segment of path) {
      if (result && typeof result === 'object' && segment in result) {
        result = result[segment];
      } else {
        return key;
      }
    }

    return typeof result === 'string' ? result : key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
