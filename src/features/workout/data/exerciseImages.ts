import { ImageSourcePropType } from 'react-native';

// Egzersiz slug → liste/kamera kartındaki sol görsel.
// Görseller src/assets/exercises/ altında, dosya adı slug ile aynıdır.
// Yeni bir egzersize görsel eklemek için: görseli o klasöre koy ve buraya
// slug → require(...) satırı ekle. Eşleşme yoksa ekran nötr placeholder gösterir.
export const EXERCISE_IMAGES: Record<string, ImageSourcePropType> = {
  'biceps-curl':        require('../../../assets/exercises/biceps-curl.png'),
  'shoulder-abduction': require('../../../assets/exercises/shoulder-abduction.png'),
  'knee-raise':         require('../../../assets/exercises/knee-raise.png'),
};
