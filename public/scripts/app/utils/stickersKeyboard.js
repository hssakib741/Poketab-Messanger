import { Stickers } from './../../../stickers/stickersConfig.js';
import { parseTemplate } from './messageParser.js';

const stickersTemplate = document.getElementById('stickersTemplate');
document.getElementById('stickersTemplate').remove();

export function loadStickerHeaders() {
	const heads = Object.values(Stickers).map((sticker) => {
		return `<img src="/stickers/${sticker.name}/animated/${sticker.icon}.webp" class="${sticker.name}" data-name="${sticker.name}" alt="${sticker.name}">`;
	}).join('');

	let stickersArray = '';

	Object.values(Stickers).forEach((sticker) => {
		let stickerBoard = '';

		for (let i = 1; i <= sticker.count; i++) {
			stickerBoard += `<img src="/stickers/${sticker.name}/static/${i}-mini.webp" data-name="${sticker.name}/animated/${i}" class="sendable">`;
		}

		stickersArray += `
      <div class="stickerBoard ${sticker.name}">
        ${stickerBoard}
      </div>`;
	});

	const stickersKeyboard = parseTemplate(stickersTemplate.innerHTML, {
		heads: heads,
		stickers: stickersArray
	});

	document.getElementById('stickersKeyboard').innerHTML += stickersKeyboard;

	const stickerHeads = document.querySelector('.stickersHeader');

	stickerHeads.addEventListener('click', (e) => {
		if (e.target.dataset.name) {
			const stickerBoard = document.querySelector(`.stickerBoard.${e.target.dataset.name}`);
			setTimeout(() => {
				stickerBoard.scrollIntoView();
			}, 150);
		}
	});

	const prevBtn = document.querySelector('.headers .prev');
	const nextBtn = document.querySelector('.headers .next');

	prevBtn.addEventListener('click', () => {
		const stickerHeads = document.querySelector('.stickersHeader');
		stickerHeads.scrollBy(-100, 0);
	});

	nextBtn.addEventListener('click', () => {
		const stickerHeads = document.querySelector('.stickersHeader');
		stickerHeads.scrollBy(100, 0);
	});

	const stickerBoards = document.querySelectorAll('.stickerBoard');

	const observer = new IntersectionObserver((entries) => {
		entries.forEach((entry) => {
			if (entry.isIntersecting) {
				const inViewSticker = entry.target.classList[1];
				localStorage.setItem('selectedSticker', inViewSticker);
				console.log(inViewSticker);
				document.querySelectorAll('.stickersHeader img').forEach((stickerHead) => {
					stickerHead.dataset.selected = false;
				});
				const stickerHead = document.querySelector(`.stickersHeader img[data-name="${inViewSticker}"]`);
				stickerHead.dataset.selected = true;
			}
		});
	}, { threshold: 0.5 });

	stickerBoards.forEach((stickerBoard) => {
		observer.observe(stickerBoard);
	});
}