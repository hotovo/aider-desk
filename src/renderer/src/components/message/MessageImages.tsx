import { useState } from 'react';
import { createPortal } from 'react-dom';
import { IoClose } from 'react-icons/io5';
import { AnimatePresence, motion } from 'framer-motion';

type Props = {
  images: string[];
  altPrefix?: string;
  thumbnailClassName?: string;
};

export const MessageImages = ({ images, altPrefix = 'Image', thumbnailClassName }: Props) => {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  if (images.length === 0) {
    return null;
  }

  const handleImageClick = (index: number) => {
    setExpandedIndex(index);
  };

  const handleExpandedClick = () => {
    setExpandedIndex(null);
  };

  return (
    <>
      <div className="flex flex-wrap gap-2 mt-2">
        {images.map((src, index) => (
          <img
            key={index}
            src={src}
            alt={`${altPrefix} ${index + 1}`}
            className={
              thumbnailClassName ??
              'max-h-40 max-w-[200px] rounded-md border border-border-dark-light cursor-pointer hover:opacity-80 transition-opacity object-contain'
            }
            onClick={() => handleImageClick(index)}
          />
        ))}
      </div>
      {createPortal(
        <AnimatePresence>
          {expandedIndex !== null && (
            <motion.div
              className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 cursor-pointer p-8"
              onClick={handleExpandedClick}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <motion.img
                src={images[expandedIndex]}
                alt={`${altPrefix} ${expandedIndex + 1}`}
                className="max-w-[90vw] max-h-[90vh] object-contain"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ duration: 0.15 }}
                onClick={(e) => e.stopPropagation()}
              />
              <motion.button
                type="button"
                className="fixed top-4 right-4 z-[10000] flex items-center justify-center w-10 h-10 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  handleExpandedClick();
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <IoClose className="w-6 h-6" />
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
};
