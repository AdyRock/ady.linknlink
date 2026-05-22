/* busy_indicator | busy_indicator 0.10.0 | License - GNU LGPL 3 */
/*
  This library is free software: you can redistribute it and/or modify
  it under the terms of the GNU Lesser General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU Lesser General Public License for more details.

  You should have received a copy of the GNU Lesser General Public License
  along with this program.  If not, see <http://www.gnu.org/licenses/>.

  https://github.com/lego12239/busy_indicator.js
*/

'use strict';

function BusyIndicator(containerEl, imageEl, showCb, hideCb)
{
	this.elements = {
		container: null,
		image: imageEl,
	};

	this.callbacks = {
		show: showCb,
		hide: hideCb,
	};

	this.position = {
		x: 0,
		y: 0,
	};

	this.showClass = 'show';
	this.counter = 0;

	this._setRequiredElement('container', containerEl);
}

BusyIndicator.prototype._setRequiredElement = function setRequiredElement(name, value)
{
	if (value === undefined || value === null)
	{
		throw new Error(`busy_indicator: ${name} is not supplied`);
	}

	this.elements[name] = value;
};

BusyIndicator.prototype.show = function show()
{
	this.counter += 1;
	if (this.counter > 1)
	{
		return;
	}

	this.elements.container.classList.add(this.showClass);
	this.align();

	if (this.callbacks.show)
	{
		this.callbacks.show();
	}
};

BusyIndicator.prototype.align = function align()
{
	if (!this.elements.image)
	{
		return;
	}

	this.position = this.calcPos();

	this.elements.image.style.top = `${this.position.y}px`;
	this.elements.image.style.left = `${this.position.x}px`;
};

BusyIndicator.prototype.calcPos = function calcPos()
{
	const x = (this.elements.container.clientWidth / 2) - (this.elements.image.offsetWidth / 2);
	const y = (this.elements.container.clientHeight / 2) - (this.elements.image.offsetHeight / 2);

	return { x, y };
};

BusyIndicator.prototype.hide = function hide()
{
	if (this.counter <= 0)
	{
		return;
	}

	this.counter -= 1;
	if (this.counter)
	{
		return;
	}

	this.elements.container.classList.remove(this.showClass);

	if (this.callbacks.hide)
	{
		this.callbacks.hide();
	}
};

if (typeof globalThis !== 'undefined')
{
	globalThis['busy_indicator'] = BusyIndicator;
}
