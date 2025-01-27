// Inital method to call to apply PanZoom to elements given a selector
export function PanZoom(element, opts) {
	opts = opts || {};
	let minScale = (opts.minScale ? opts.minScale : 0.4);
	let maxScale = (opts.maxScale ? opts.maxScale : 3);
	let increment = (opts.increment ? opts.increment  : 0.05);
	let liner = (opts.liner ? opts.liner  : false);
	new AttachPanZoom(element, minScale , maxScale, increment, liner);
}

// Appy PanZoom functionality to a given element, allow user defined zoom min and inc per scroll
class AttachPanZoom {
	constructor(ele, minScale, maxScale, increment, liner) {
		this.increment = increment;
		this.minScale = minScale;
		this.maxScale = maxScale;
		this.liner = liner;
		this.panning = false;
		this.oldX = this.oldY = 0;
		let self = this;
		ele.style.transform = 'matrix(1, 0, 0, 1, 0, 0)';

		// Gets the current Scale, along with transX and transY
		this.getTransformMatrix = function () {
			let trans = ele.style.transform;
			let start = trans.indexOf('(') + 1;
			let end = trans.indexOf(')');
			let matrix = trans.slice(start, end).split(',');
			return {
				'scale': +matrix[0],
				'transX': +matrix[4],
				'transY': +matrix[5]
			};
		};

		// Given the scale, translateX and translateY apply to CSSS transform
		this.setTransformMatrix = function (o) {
			ele.style.transform = 'matrix(' + o.scale + ', 0, 0, ' + o.scale + ', ' + o.transX + ', ' + o.transY + ')';
		};

		this.applyTranslate = function (dx, dy) {
			let newTrans = this.getTransformMatrix();
			newTrans.transX += dx;
			newTrans.transY += dy;
			this.setTransformMatrix(newTrans);
		};

		// Applying Deltas to Scale and Translate transformations
		this.applyScale = function (dscale, x, y) {
			let newTrans = this.getTransformMatrix();
			let width = ele.width ? ele.width : ele.offsetWidth;
			let height = ele.height ? ele.height : ele.offsetHeight;
			let tranX = x - (width / 2);
			let tranY = y - (height / 2);
			dscale = (this.liner ? dscale : dscale * (newTrans.scale)); // scale either liner or non-liner 
			newTrans.scale += dscale;
			let maxOrMinScale = (newTrans.scale <= this.minScale || newTrans.scale >= this.maxScale);
			if (newTrans.scale < this.minScale)
				newTrans.scale = this.minScale;
			if (newTrans.scale > this.maxScale)
				newTrans.scale = this.maxScale;
			if (!maxOrMinScale) {
				this.applyTranslate(tranX, tranY);
				this.setTransformMatrix(newTrans);
				this.applyTranslate(-(tranX * dscale), -(tranY * dscale));
			}
		};

		// Capture when the mouse is down on the element or not
		ele.addEventListener('mousedown', function (e) {
			e.preventDefault();
			this.panning = true;
			this.oldX = e.clientX;
			this.oldY = e.clientY;
		});

		ele.addEventListener('mouseup', function (e) { this.panning = false; });
		ele.addEventListener('mouseleave', function (e) { this.panning = false; });

		ele.addEventListener('mousemove', function (e) {
			if (this.panning) {
				let deltaX = e.clientX - this.oldX;
				let deltaY = e.clientY - this.oldY;
				self.applyTranslate(deltaX, deltaY);
				this.oldX = e.clientX;
				this.oldY = e.clientY;
			}
		});

		//double tap to reset
		ele.addEventListener('dblclick', function (e) {
			let newTrans = self.getTransformMatrix();
			newTrans.scale = 1;
			newTrans.transX = 0;
			newTrans.transY = 0;
			self.setTransformMatrix(newTrans);
		});


		this.getScrollDirection = function (e) {
			let delta = Math.max(-1, Math.min(1, (e.wheelDelta || -e.detail)));
			if (delta < 0){
				self.applyScale(-self.increment, e.offsetX, e.offsetY);
			}
			else{
				self.applyScale(self.increment, e.offsetX, e.offsetY);
			}
		};

		ele.addEventListener('DOMMouseScroll', this.getScrollDirection, false);
		ele.addEventListener('mousewheel', this.getScrollDirection, false);
	}
}
